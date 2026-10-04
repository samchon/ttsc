//go:build e2e

package driver_test

import (
  "bytes"
  _ "embed"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceRejectsOversizedStdout checks the stdout-limit
// refusal from a child response before the malformed x bytes reach JSON decoding.
//
// A broken plugin must not be able to make ttscserver buffer arbitrary stdout
// while serving editor requests. The bridge should reject oversized output and
// log its size refusal instead of attempting to unmarshal it. This case does
// not measure allocation or retained-buffer size.
//
// 1. Build a fake sidecar with valid command discovery.
// 2. Have `lsp-code-actions` write more than the bridge stdout limit.
// 3. Assert no actions are returned and the log names the stdout limit failure.
//
// @evidence contracts/testing.md#behavioral-verification CodeActions returns no actions and logs produced more than when the fixture writes 6 MiB stdout.
// @evidence contracts/testing.md#independent-expectations The authored 6 MiB x response exceeds the documented 4 MiB cap, so the size refusal must precede malformed-JSON handling; this oracle does not measure allocation or buffer retention.
// @evidence contracts/testing.md#distinguishing-cases Overflow is rejected while the separate exactly-at-limit diagnostics payload is accepted.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes NativePluginSource using a built static child that writes actual oversized output; this is a native capture/protocol boundary without an editor or installed CLI.
// @evidence contracts/e2e.md#necessary-boundary Actual child stdout crosses the bounded native capture before action decoding; the specific size log plus no actions distinguishes overflow admission from an unrelated malformed-JSON failure.
// @evidence contracts/e2e.md#shared-execution This unchanged 6 MiB response generator shares the one lazy dispatcher build with the exact-capacity and other native fixture entries.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private source, cwd and log buffer isolate the overflow case. Shared artifact bytes are unchanged; cleanup waits for source completion before removal and retains inputs on unresolved completion, without certifying arbitrary descendant lifetime.
// @evidence contracts/e2e.md#preserved-coverage Original over-cap output, zero returned actions and size-refusal log remain here; exact-limit valid diagnostics retain their separate positive case, and no measured-memory bound is inferred.
func TestLSPNativePluginSourceRejectsOversizedStdout(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceOversizedStdoutSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{{Binary: sidecar, Name: "@ttsc/fake"}},
  })
  if err != nil {
    t.Fatal(err)
  }
  var errBuf bytes.Buffer
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    Err:          &errBuf,
    ManifestJSON: string(manifest),
    Tsconfig:     "tsconfig.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  fixture.source = source
  if actions := source.CodeActions("file:///tmp/a.ts", driver.LSPRange{}, driver.LSPCodeActionContext{}); len(actions) != 0 {
    t.Fatalf("oversized sidecar returned actions: %#v", actions)
  }
  if !strings.Contains(errBuf.String(), "produced more than") {
    t.Fatalf("missing oversized stdout log:\n%s", errBuf.String())
  }
}

//go:embed testdata/native-plugin-source/oversized-stdout.go.txt
var nativePluginSourceOversizedStdoutSidecar string
