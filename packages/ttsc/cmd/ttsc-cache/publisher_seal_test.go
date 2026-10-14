package main

import (
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "net/http"
  "net/http/httptest"
  "os"
  "os/exec"
  "path/filepath"
  "regexp"
  "runtime"
  "strings"
  "testing"
)

// TestPublisherSeal verifies an actual recorded Go action through released-pack admission.
//
// Verifies: a publisher's full action and body can be sealed, transferred in bulk, and used by a relocated stock-Go consumer without compiling the package.
// 1. Compile one package with the production helper recording into an empty overlay and retain Go's action graph and package receipts.
// 2. Seal a release-pinned ZIP, serve it from loopback, and admit it into an independent consumer base.
// 3. Build the same package from a different source root with a fresh Go cache, then compare archive bytes and compiler commands.
//
// @evidence contracts/testing.md#behavioral-verification The test executes the shipped helper's recording, sealing, preparation and protocol modes with stock Go, asserting a complete manifest digest, a real base hit and byte-identical archives.
// @evidence contracts/testing.md#independent-expectations The literal package source and Go's own cold first-build compiler command establish a compile that the independent second cache must avoid; SHA-256 of each emitted archive establishes output equality.
// @evidence contracts/testing.md#distinguishing-cases Distinct source, overlay, base and GOCACHE roots distinguish publisher reuse from an ordinary warm build; direct helper tests own malformed transport and protocol cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go integration test builds a local helper and two private modules, serves one loopback pack, and removes all files through t.TempDir; no consumer install or external network is involved.
func TestPublisherSeal(t *testing.T) {
  if runtime.Version() != "go1.26.0" {
    t.Skip("publisher protocol is pinned to Go 1.26.0")
  }
  goBinary, err := exec.LookPath("go")
  if err != nil {
    t.Fatal(err)
  }
  goBinary, err = filepath.Abs(goBinary)
  if err != nil {
    t.Fatal(err)
  }
  root := filepath.Join(t.TempDir(), "publisher path with spaces")
  if err := os.MkdirAll(root, 0700); err != nil {
    t.Fatal(err)
  }
  helper := filepath.Join(root, "cache helper"+exeSuffix())
  buildHelper := exec.Command(goBinary, "build", "-trimpath", "-o", helper, ".")
  if output, err := buildHelper.CombinedOutput(); err != nil {
    t.Fatalf("helper build: %v\n%s", err, output)
  }
  source := "package tiny\nfunc Value() string { return \"sealed action\" }\n"
  makeModule := func(name string) string {
    directory := filepath.Join(root, name)
    if err := os.MkdirAll(directory, 0700); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filepath.Join(directory, "go.mod"), []byte("module example.org/ttsc-cache-seal\n\ngo 1.26\n"), 0600); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filepath.Join(directory, "tiny.go"), []byte(source), 0600); err != nil {
      t.Fatal(err)
    }
    return directory
  }
  publisher := makeModule("publisher")
  consumer := makeModule("consumer")
  graph := filepath.Join(root, "actiongraph.json")
  packages := filepath.Join(root, "packages.json")
  list := exec.Command(goBinary, "list", "-deps", "-json", ".")
  list.Dir = publisher
  list.Env = append(os.Environ(), "CGO_ENABLED=0", "GOFLAGS=", "GOWORK=off", "GOPROXY=off", "GOSUMDB=off", "GOTOOLCHAIN=local", "GOCACHEPROG=")
  listOutput, err := list.CombinedOutput()
  if err != nil {
    t.Fatalf("publisher package receipts: %v\n%s", err, listOutput)
  }
  if err := os.WriteFile(packages, listOutput, 0600); err != nil {
    t.Fatal(err)
  }
  serverRoot := filepath.Join(root, "sealed")
  server := httptest.NewServer(http.FileServer(http.Dir(serverRoot)))
  defer server.Close()
  compile := regexp.MustCompile(`(?m)[/\\]compile(?:\.exe)?["']?\s`)
  build := func(directory, cache, program, archive, graphPath string) (string, int) {
    if err := os.MkdirAll(cache, 0700); err != nil {
      t.Fatal(err)
    }
    args := []string{"build", "-trimpath", "-x", "-o", archive}
    if graphPath != "" {
      args = append(args, "-debug-actiongraph="+graphPath)
    }
    args = append(args, ".")
    command := exec.Command(goBinary, args...)
    command.Dir = directory
    command.Env = append(os.Environ(), "CGO_ENABLED=0", "GOFLAGS=", "GOWORK=off", "GOPROXY=off", "GOSUMDB=off", "GOTOOLCHAIN=local", "GOCACHE="+cache, "GOCACHEPROG="+program)
    output, err := command.CombinedOutput()
    if err != nil {
      t.Fatalf("stock Go build: %v\n%s", err, output)
    }
    body, err := os.ReadFile(archive)
    if err != nil {
      t.Fatal(err)
    }
    sum := sha256.Sum256(body)
    return hex.EncodeToString(sum[:]), len(compile.FindAll(output, -1))
  }
  overlay := filepath.Join(root, "publisher overlay")
  firstProgram := quoteGoCacheArgument(helper) + " -root " + quoteGoCacheArgument(overlay)
  firstHash, firstCompiles := build(publisher, filepath.Join(root, "publisher go cache"), firstProgram, filepath.Join(root, "first.a"), graph)
  if firstCompiles == 0 {
    t.Fatal("publisher did not compile the package")
  }
  seal := exec.Command(helper, "-seal", "-root", overlay, "-go", goBinary, "-actiongraph", graph, "-packages", packages, "-release", "0.32.1", "-source-commit", strings.Repeat("a", 40), "-pack-url-base", server.URL, "-pack-name", "tiny", "-out", serverRoot)
  seal.Env = append(os.Environ(), "CGO_ENABLED=0", "GOFLAGS=", "GOWORK=off", "GOPROXY=off", "GOSUMDB=off", "GOTOOLCHAIN=local")
  output, err := seal.CombinedOutput()
  if err != nil {
    t.Fatalf("seal recorded actions: %v\n%s", err, output)
  }
  var sealed struct {
    ManifestSHA256 string `json:"manifestSHA256"`
    Actions        int    `json:"actions"`
  }
  if err := json.Unmarshal(output, &sealed); err != nil || sealed.Actions == 0 || len(sealed.ManifestSHA256) != 64 {
    t.Fatalf("invalid publisher seal receipt: %s %v", output, err)
  }
  manifest := filepath.Join(serverRoot, "manifest.json")
  base := filepath.Join(root, "independent consumer base")
  prepare := exec.Command(helper, "-root", base, "-manifest", manifest, "-manifest-sha256", sealed.ManifestSHA256, "-prepare", "-packs", "tiny")
  if output, err := prepare.CombinedOutput(); err != nil {
    t.Fatalf("prepare sealed pack: %v\n%s", err, output)
  }
  secondProgram := quoteGoCacheArgument(helper) + " -root " + quoteGoCacheArgument(base) + " -manifest " + quoteGoCacheArgument(manifest) + " -manifest-sha256 " + sealed.ManifestSHA256
  secondHash, secondCompiles := build(consumer, filepath.Join(root, "consumer go cache"), secondProgram, filepath.Join(root, "second.a"), "")
  if secondCompiles != 0 || firstHash != secondHash {
    t.Fatalf("sealed publisher package was not reused: compiles=%d/%d hashes=%s/%s", firstCompiles, secondCompiles, firstHash, secondHash)
  }
}
