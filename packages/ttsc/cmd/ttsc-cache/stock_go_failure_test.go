package main

import (
  "context"
  "errors"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
  "time"
)

// TestStockGoCacheFailures verifies the real Go client's response to an already-started bad helper.
//
// Verifies: a malformed response and premature helper exit fail the Go build promptly and do not silently replay it against a local cache.
// 1. Build a small helper that advertises the protocol, then emits malformed JSON or exits.
// 2. Run stock Go against each mode with a fresh local cache and a fixed failure deadline.
// 3. Require an identified cache-helper failure, no output archive, and no deadline expiry.
//
// @evidence contracts/testing.md#behavioral-verification Runs stock go build with GOCACHEPROG pointing to a deliberately broken executable and checks its process result and missing output.
// @evidence contracts/testing.md#independent-expectations The stock Go client owns the helper failure contract: invalid JSON or EOF after valid startup cannot represent an action miss, so the build must fail without producing an archive.
// @evidence contracts/testing.md#distinguishing-cases Covers malformed response and premature exit after valid capabilities; the production helper's valid protocol, hit and miss cases belong to TestStockGoCacheClient and TestCacheProtocol.
// @evidence contracts/testing.md#execution-ownership This narrow Go subprocess test uses a temporary helper and tiny local module; it never installs a consumer or runs the product E2E suite.
func TestStockGoCacheFailures(t *testing.T) {
  if !supportedGoVersion.MatchString(runtime.Version()) {
    t.Skip("the helper protocol requires a stock Go 1.26 or 1.27 patch release")
  }
  root := t.TempDir()
  helperSource := filepath.Join(root, "broken-helper.go")
  source := `package main
import (
  "bufio"
  "fmt"
  "os"
)
func main() {
  fmt.Println("{\"ID\":0,\"KnownCommands\":[\"get\",\"put\",\"close\"]}")
  if _, err := bufio.NewReader(os.Stdin).ReadBytes('\n'); err != nil {
    return
  }
  if os.Getenv("TTSC_BAD_HELPER_MODE") == "malformed" {
    fmt.Println("{broken")
  }
}
`
  if err := os.WriteFile(helperSource, []byte(source), 0600); err != nil {
    t.Fatal(err)
  }
  helper := filepath.Join(root, "broken helper"+exeSuffix())
  compile := exec.Command("go", "build", "-o", helper, helperSource)
  compile.Env = append(os.Environ(), "GOCACHEPROG=", "GOTOOLCHAIN=local")
  if output, err := compile.CombinedOutput(); err != nil {
    t.Fatalf("building failing cache helper: %v\n%s", err, output)
  }
  module := filepath.Join(root, "client")
  if err := os.MkdirAll(module, 0700); err != nil {
    t.Fatal(err)
  }
  for name, body := range map[string]string{
    "go.mod":  "module example.org/broken-cache-client\n\ngo 1.26\n",
    "tiny.go": "package tiny\nfunc Value() string { return \"stock Go\" }\n",
  } {
    if err := os.WriteFile(filepath.Join(module, name), []byte(body), 0600); err != nil {
      t.Fatal(err)
    }
  }
  for _, mode := range []string{"malformed", "premature"} {
    t.Run(mode, func(t *testing.T) {
      cache := filepath.Join(root, "cache-"+mode)
      if err := os.MkdirAll(cache, 0700); err != nil {
        t.Fatal(err)
      }
      archive := filepath.Join(root, "archive-"+mode+".a")
      context, cancel := context.WithTimeout(context.Background(), 30*time.Second)
      defer cancel()
      build := exec.CommandContext(context, "go", "build", "-trimpath", "-o", archive, ".")
      build.Dir = module
      build.Env = append(os.Environ(),
        "CGO_ENABLED=0", "GOFLAGS=", "GOWORK=off", "GOPROXY=off", "GOSUMDB=off", "GOTOOLCHAIN=local",
        "GOCACHE="+cache, "GOCACHEPROG="+quoteGoCacheArgument(helper), "TTSC_BAD_HELPER_MODE="+mode,
      )
      output, err := build.CombinedOutput()
      expected := map[string]string{"malformed": "invalid character", "premature": "exited pre-Close"}[mode]
      if err == nil || context.Err() != nil || !strings.Contains(string(output), "GOCACHEPROG") || !strings.Contains(string(output), expected) {
        t.Fatalf("stock Go did not fail promptly at the helper boundary: error=%v deadline=%v output=%s", err, context.Err(), output)
      }
      if _, err := os.Stat(archive); !errors.Is(err, os.ErrNotExist) {
        t.Fatalf("stock Go produced an archive after a helper failure: %v", err)
      }
    })
  }
}
