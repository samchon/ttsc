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

// TestLSPNativePluginSourceTruncatesFailureStderr checks the retained stderr
// prefix and bounded failure log from the actual failed child verb. It does
// not measure allocation or all internal buffer retention.
//
// Plugin processes are editor-facing in `ttscserver`; a broken sidecar should
// not be able to make the server retain arbitrary stderr while formatting the
// error log. The bridge caps stderr and marks the message as truncated.
//
// 1. Build a fake sidecar with valid discovery verbs.
// 2. Have `lsp-code-actions` write large stderr and exit non-zero.
// 3. Assert no actions are returned and the log is truncated.
//
// @evidence contracts/testing.md#behavioral-verification A failing fixture writes 2 MiB stderr; CodeActions returns no actions, retains a 1 MiB x prefix, logs stderr truncated and stays below 1 MiB plus diagnostic overhead.
// @evidence contracts/testing.md#independent-expectations The documented stderr cap and deliberate nonzero fixture exit provide independent failure expectations.
// @evidence contracts/testing.md#distinguishing-cases Large stderr on failure differs from oversized successful stdout and exact-capacity valid JSON.
// @evidence contracts/testing.md#execution-ownership Go test/driver crosses NativePluginSource's actual child stderr/exit boundary using the built static failing fixture and checks the resulting log, without an editor or installed CLI.
// @evidence contracts/e2e.md#necessary-boundary The child emits oversized stderr then exits nonzero; native capture must preserve the allowed prefix and report truncation while returning no actions, which a local message formatter alone would not establish.
// @evidence contracts/e2e.md#shared-execution The unchanged stderr generator shares the existing lazy dispatcher build with successful, exact-capacity and overflow fixture entries; no separate build is requested for this failure.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its source, cwd and error buffer; shared artifact bytes are unchanged. Cleanup waits for the supported completion barrier before removal or retains unresolved inputs, without certifying arbitrary descendant lifetime.
// @evidence contracts/e2e.md#preserved-coverage Original 2 MiB output/nonzero exit, zero-action, truncation marker and log upper-bound assertions remain; an independent 1 MiB x-prefix positive also rules out wholly discarded stderr. Internal allocation is not observed.
func TestLSPNativePluginSourceTruncatesFailureStderr(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceOversizedStderrSidecar)
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
    t.Fatalf("stderr-failing sidecar returned actions: %#v", actions)
  }
  log := errBuf.String()
  if !strings.Contains(log, "stderr truncated") {
    t.Fatalf("missing stderr truncation marker:\n%s", log)
  }
  if !strings.Contains(log, strings.Repeat("x", 1024*1024)) {
    t.Fatalf("stderr log lost the allowed x prefix: %d bytes", len(log))
  }
  if len(log) > 1024*1024+4096 {
    t.Fatalf("stderr log was not bounded: %d bytes", len(log))
  }
}

//go:embed testdata/native-plugin-source/oversized-stderr.go.txt
var nativePluginSourceOversizedStderrSidecar string
