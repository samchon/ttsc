package main

import (
  "crypto/sha256"
  "encoding/hex"
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
// Verifies: a fresh Go build fills the overlay and a relocated consumer reuses those exact actions without compiling them again.
// 1. Build the helper from this package and two identical modules under distinct paths.
// 2. Give each build an empty Go cache but the same local helper store, with a quoted helper path.
// 3. Compare package archive bytes and require compilation only on the first build.
//
// @evidence contracts/testing.md#behavioral-verification Runs stock go build with GOCACHEPROG through the production helper executable, then observes compiler commands and archive bytes.
// @evidence contracts/testing.md#independent-expectations Two identical literal module sources and -trimpath should request the same Go actions; a fresh first cache must compile while a second fresh cache can only skip via the shared helper overlay.
// @evidence contracts/testing.md#distinguishing-cases Exercises actual Go 1.26 protocol startup, put/get, path quoting, source relocation and independent local Go caches; malformed framing is covered by the direct protocol owner test.
// @evidence contracts/testing.md#execution-ownership The test runs three local Go commands in temporary directories and never contacts a module proxy or publishes a release artifact.
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
  compileCommand := regexp.MustCompile(`(?m)[/\\]compile(?:\.exe)?["']?\s`)
  var archiveDigests [2]string
  var compileCounts [2]int
  for phase, name := range []string{"publisher", "relocated consumer"} {
    directory := filepath.Join(root, name)
    if err := os.MkdirAll(directory, 0700); err != nil {
      t.Fatal(err)
    }
    for file, source := range map[string]string{
      "go.mod":  "module example.org/ttsc-cache-client\n\ngo 1.26\n",
      "tiny.go": "package tiny\nfunc Value() string { return \"exact action\" }\n",
    } {
      if err := os.WriteFile(filepath.Join(directory, file), []byte(source), 0600); err != nil {
        t.Fatal(err)
      }
    }
    goCache := filepath.Join(directory, "empty go cache")
    if err := os.MkdirAll(goCache, 0700); err != nil {
      t.Fatal(err)
    }
    archive := filepath.Join(directory, "result.a")
    build := exec.Command("go", "build", "-trimpath", "-x", "-o", archive, ".")
    build.Dir = directory
    build.Env = append(os.Environ(),
      "CGO_ENABLED=0", "GOFLAGS=", "GOCACHE="+goCache,
      "GOCACHEPROG="+program, "GOPROXY=off", "GOSUMDB=off", "GOTOOLCHAIN=local",
    )
    output, err := build.CombinedOutput()
    if err != nil {
      t.Fatalf("%s stock Go build: %v\n%s", name, err, output)
    }
    compileCounts[phase] = len(compileCommand.FindAll(output, -1))
    raw, err := os.ReadFile(archive)
    if err != nil {
      t.Fatal(err)
    }
    digest := sha256.Sum256(raw)
    archiveDigests[phase] = hex.EncodeToString(digest[:])
  }
  if compileCounts[0] == 0 || compileCounts[1] != 0 || archiveDigests[0] != archiveDigests[1] {
    t.Fatalf("stock Go did not reuse exact relocated actions: compiles=%v archives=%v", compileCounts, archiveDigests)
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
