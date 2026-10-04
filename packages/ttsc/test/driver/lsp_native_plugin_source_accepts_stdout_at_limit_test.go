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

// TestLSPNativePluginSourceAcceptsStdoutAtLimit verifies the stdout cap rejects
// overflow, not the exact boundary.
//
// The limited writer can hold exactly 4 MiB without truncation. Rejecting the
// boundary makes the contract stricter than the implementation needs and can
// turn a valid JSON payload into an error.
//
// 1. Build a sidecar whose diagnostics payload is padded to exactly 4 MiB.
// 2. Ask NativePluginSource for diagnostics.
// 3. Assert the payload decodes and no bridge error is logged.
//
// @evidence contracts/testing.md#behavioral-verification Diagnostics decodes one diagnostic with the entire authored x padding from an exactly 4 MiB response and logs no error.
// @evidence contracts/testing.md#independent-expectations The documented stdout bound is inclusive; the fixture independently pads its authored JSON to that exact byte size.
// @evidence contracts/testing.md#distinguishing-cases Exact capacity preserves the full padded message without a logged error; the separate oversized stdout case exceeds the cap.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes NativePluginSource against a built static sidecar through actual child output and native bounded capture; this is a protocol boundary, not a portable unit call.
// @evidence contracts/e2e.md#necessary-boundary A real child writes the inclusive stdout limit through NativePluginSource capture and diagnostic decoding, distinguishing a truncated or rejected boundary response from an intact one.
// @evidence contracts/e2e.md#shared-execution The existing lazy dispatcher build serves the static exact-limit fixture alongside its other unchanged protocol inputs, without another build for this case.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its source, cwd and error buffer; unchanged sidecar build bytes are shared. Fixture cleanup uses the source completion barrier before removal and retains unresolved inputs, without certifying arbitrary descendant or scheduler completion.
// @evidence contracts/e2e.md#preserved-coverage Original diagnostic-count/nonempty-message/no-log checks remain and an independent full-length/all-x check preserves the actual 4 MiB payload distinction; the over-limit refusal remains separate.
func TestLSPNativePluginSourceAcceptsStdoutAtLimit(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceStdoutAtLimitSidecar)
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
  diagnostics := source.Diagnostics(driver.LSPDocumentVersion{URI: "file:///tmp/a.ts"})
  if len(diagnostics.Document) != 1 || diagnostics.Document[0].Message == "" {
    t.Fatalf("expected padded diagnostics payload to decode: %#v", diagnostics)
  }
  prefix := `[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"source":"ttsc/fake","message":"`
  suffix := `"}]`
  if message := diagnostics.Document[0].Message; len(message) != 4*1024*1024-len(prefix)-len(suffix) || strings.Trim(message, "x") != "" {
    t.Fatalf("boundary message padding was not preserved: length=%d", len(message))
  }
  if errBuf.Len() != 0 {
    t.Fatalf("unexpected bridge stderr: %s", errBuf.String())
  }
}

//go:embed testdata/native-plugin-source/stdout-at-limit.go.txt
var nativePluginSourceStdoutAtLimitSidecar string
