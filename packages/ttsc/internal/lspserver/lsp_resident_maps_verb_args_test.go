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
//
// @evidence contracts/testing.md#behavioral-verification serveRun maps a code-actions argv carrying --uri, --range-json and --context-json into the resident request with each field verbatim, including JSON payloads.
// @evidence contracts/testing.md#independent-expectations The expected request fields are the literal argv values.
// @evidence contracts/testing.md#distinguishing-cases Three fields of different shapes must all land, so a mapping that drops the range fails.
// @evidence contracts/testing.md#execution-ownership TestResidentMapsVerbArgs is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
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
