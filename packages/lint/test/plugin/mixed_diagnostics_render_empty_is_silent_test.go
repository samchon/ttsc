package linthost

import (
  "bytes"
  "testing"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// TestMixedDiagnosticsRenderEmptyIsSilent verifies the shared renderer keeps
// the zero-diagnostic fast path silent after mixed-order support is added.
//
// 1. Render an empty parser and lint batch.
// 2. Observe the returned error count and captured output.
// 3. Assert no summary or diagnostic text was introduced.
func TestMixedDiagnosticsRenderEmptyIsSilent(t *testing.T) {
  var rendered bytes.Buffer
  if got := shimdw.FormatMixedDiagnostics(&rendered, nil, nil, "/virtual"); got != 0 {
    t.Fatalf("empty render error count = %d, want 0", got)
  }
  if rendered.Len() != 0 {
    t.Fatalf("empty render produced output: %q", rendered.String())
  }
}
