package lspserver

import "testing"

// TestResidentMapsVerbArgs verifies the resident client rebuilds a serve request
// from the same --flag=value argv the spawn-per-verb path passes.
//
// The two transports share one call shape at the source's verb methods:
// Diagnostics/CodeActions build `--uri=`, `--range-json=`, `--context-json=`
// argv, and serveRun must map those back into the request the daemon reads, or
// a code-action would arrive at the warm Program with no range and quietly
// offer nothing.
//
//  1. Map a code-actions argv carrying all three fields.
//  2. Assert each field lands, verbatim, including JSON payloads.
func TestResidentMapsVerbArgs(t *testing.T) {
  req := serveRequestFromArgs("lsp-code-actions", []string{
    "--uri=file:///a.ts",
    `--range-json={"start":{"line":1,"character":2}}`,
    `--context-json={"only":["quickfix.ttsc"]}`,
  })
  if req.Verb != "lsp-code-actions" {
    t.Fatalf("verb = %q, want lsp-code-actions", req.Verb)
  }
  if req.URI != "file:///a.ts" {
    t.Fatalf("uri = %q", req.URI)
  }
  if req.RangeJSON != `{"start":{"line":1,"character":2}}` {
    t.Fatalf("rangeJson = %q", req.RangeJSON)
  }
  if req.ContextJSON != `{"only":["quickfix.ttsc"]}` {
    t.Fatalf("contextJson = %q", req.ContextJSON)
  }
}
