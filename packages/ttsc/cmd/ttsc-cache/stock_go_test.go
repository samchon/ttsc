package main

import (
  "archive/zip"
  "bytes"
  "crypto/sha256"
  "encoding/hex"
  "net/url"
  "os"
  "os/exec"
  "path/filepath"
  "regexp"
  "runtime"
  "strings"
  "testing"
)

// TestStockGoCacheClient verifies the helper against the actual supported Go client.
//
// Verifies: a relocated module and dependency cache reuse exact actions, while a dependency update misses.
// 1. Build the helper and serve two versions of a dependency from a private file proxy.
// 2. Build identical modules under distinct paths and empty Go and module caches with one helper store.
// 3. Compare archive bytes and compile counts, then change the dependency version and require compilation.
//
// @evidence contracts/testing.md#behavioral-verification Runs stock go build with GOCACHEPROG through the production helper executable, then observes compiler commands and archive bytes.
// @evidence contracts/testing.md#independent-expectations Identical source and dependency bytes under -trimpath should request the same actions; a changed dependency version must change the archive and require compilation.
// @evidence contracts/testing.md#distinguishing-cases Exercises stock Go 1.26 protocol startup, put/get, path quoting, source and module-cache relocation, and a changed dependency version.
// @evidence contracts/testing.md#execution-ownership The test runs stock Go in temporary directories with a private file proxy and never contacts the network or publishes a release artifact.
func TestStockGoCacheClient(t *testing.T) {
  if !supportedGoVersion.MatchString(runtime.Version()) {
    t.Skip("the helper protocol requires a stock Go 1.26 patch release")
  }
  root := filepath.Join(t.TempDir(), "native artifact path with spaces")
  if err := os.MkdirAll(root, 0700); err != nil {
    t.Fatal(err)
  }
  helper := filepath.Join(root, "cache helper"+exeSuffix())
  buildHelper := exec.Command("go", "build", "-trimpath", "-o", helper, ".")
  if output, err := buildHelper.CombinedOutput(); err != nil {
    t.Fatalf("building cache helper: %v\n%s", err, output)
  }
  store := filepath.Join(root, "shared artifact store")
  program := quoteGoCacheArgument(helper) + " -root " + quoteGoCacheArgument(store)
  proxy := filepath.Join(root, "private module proxy")
  for _, version := range []string{"v1.0.0", "v1.0.1"} {
    directory := filepath.Join(proxy, "example.org", "cache-dep", "@v")
    if err := os.MkdirAll(directory, 0700); err != nil {
      t.Fatal(err)
    }
    module := []byte("module example.org/cache-dep\n\ngo 1.26\n")
    info := []byte(`{"Version":"` + version + `","Time":"2026-01-01T00:00:00Z"}`)
    var archive bytes.Buffer
    writer := zip.NewWriter(&archive)
    for name, body := range map[string][]byte{
      "go.mod": module,
      "dep.go": []byte("package dep\nfunc Value() string { return \"" + version + "\" }\n"),
    } {
      entry, err := writer.Create("example.org/cache-dep@" + version + "/" + name)
      if err != nil {
        t.Fatal(err)
      }
      if _, err := entry.Write(body); err != nil {
        t.Fatal(err)
      }
    }
    if err := writer.Close(); err != nil {
      t.Fatal(err)
    }
    for extension, body := range map[string][]byte{
      ".mod": module, ".info": info, ".zip": archive.Bytes(),
    } {
      if err := os.WriteFile(filepath.Join(directory, version+extension), body, 0600); err != nil {
        t.Fatal(err)
      }
    }
  }
  proxyPath := filepath.ToSlash(proxy)
  if !strings.HasPrefix(proxyPath, "/") {
    proxyPath = "/" + proxyPath
  }
  proxyURL := (&url.URL{Scheme: "file", Path: proxyPath}).String()
  compileCommand := regexp.MustCompile(`(?m)[/\\]compile(?:\.exe)?["']?\s`)
  var archiveDigests [3]string
  var compileCounts [3]int
  for phase, name := range []string{"publisher", "relocated consumer", "updated dependency"} {
    version := "v1.0.0"
    if phase == 2 {
      version = "v1.0.1"
    }
    directory := filepath.Join(root, name)
    if err := os.MkdirAll(directory, 0700); err != nil {
      t.Fatal(err)
    }
    for file, source := range map[string]string{
      "go.mod":  "module example.org/ttsc-cache-client\n\ngo 1.26\n\nrequire example.org/cache-dep " + version + "\n",
      "tiny.go": "package tiny\nimport \"example.org/cache-dep\"\nfunc Value() string { return dep.Value() }\n",
    } {
      if err := os.WriteFile(filepath.Join(directory, file), []byte(source), 0600); err != nil {
        t.Fatal(err)
      }
    }
    goCache := filepath.Join(directory, "empty go cache")
    moduleCache := filepath.Join(directory, "empty module cache")
    if err := os.MkdirAll(goCache, 0700); err != nil {
      t.Fatal(err)
    }
    if err := os.MkdirAll(moduleCache, 0700); err != nil {
      t.Fatal(err)
    }
    archive := filepath.Join(directory, "result.a")
    build := exec.Command("go", "build", "-mod=mod", "-trimpath", "-x", "-o", archive, ".")
    build.Dir = directory
    build.Env = append(os.Environ(),
      "CGO_ENABLED=0", "GOFLAGS=", "GOWORK=off", "GOCACHE="+goCache,
      "GOMODCACHE="+moduleCache, "GOCACHEPROG="+program,
      "GOPROXY="+proxyURL, "GOSUMDB=off", "GOTOOLCHAIN=local",
    )
    output, err := build.CombinedOutput()
    if err != nil {
      t.Fatalf("%s stock Go build: %v\n%s", name, err, output)
    }
    if _, err := os.Stat(filepath.Join(moduleCache, "example.org", "cache-dep@"+version, "dep.go")); err != nil {
      t.Fatalf("%s did not populate its separate dependency cache: %v", name, err)
    }
    compileCounts[phase] = len(compileCommand.FindAll(output, -1))
    raw, err := os.ReadFile(archive)
    if err != nil {
      t.Fatal(err)
    }
    digest := sha256.Sum256(raw)
    archiveDigests[phase] = hex.EncodeToString(digest[:])
  }
  if compileCounts[0] == 0 || compileCounts[1] != 0 || compileCounts[2] == 0 ||
    archiveDigests[0] != archiveDigests[1] || archiveDigests[1] == archiveDigests[2] {
    t.Fatalf("stock Go did not distinguish relocated and updated actions: compiles=%v archives=%v", compileCounts, archiveDigests)
  }
}

func exeSuffix() string {
  if runtime.GOOS == "windows" {
    return ".exe"
  }
  return ""
}

func quoteGoCacheArgument(value string) string {
  if !strings.Contains(value, "'") {
    return "'" + value + "'"
  }
  if !strings.Contains(value, "\"") {
    return "\"" + value + "\""
  }
  panic("test path cannot be represented by Go's command quoting")
}
