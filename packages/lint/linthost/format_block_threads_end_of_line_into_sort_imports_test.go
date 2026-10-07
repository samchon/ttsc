package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockThreadsEndOfLineIntoSortImports verifies the top-level
// `format.endOfLine` is injected into the format/sort-imports rule entry.
//
// `endOfLine` is not a `sortImports` sub-key, so expandSortImportsBlock never
// sees it; config_format.go threads it in from the shared layout options. This
// pins that plumbing so the rebuilt import block joins declarations with the
// file's line ending instead of a hard-coded LF (issue #616). The absence twin
// (no endOfLine key -> rule defaults to LF) is covered by the LF sort-imports
// snapshot tests, which set no endOfLine and produce LF output.
//
//  1. Build a format block with endOfLine:"crlf" and sortImports enabled.
//  2. Call expandFormatBlock.
//  3. Assert the sort-imports rule entry carries endOfLine:"crlf".
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock emits crlf in the sort-imports options tuple when top-level endOfLine is crlf and sorting is enabled.
// @evidence contracts/testing.md#independent-expectations All emitted formatter operations must share the authored line-ending policy; literal crlf and independent tuple decoding establish the expected cross-option plumbing.
// @evidence contracts/testing.md#distinguishing-cases Owns nondefault top-level line ending reaching an enabled sorter; omitted line-ending output behavior belongs to LF sort-import formatter tests.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored crlf setting and true sorter reach expandFormatBlock and independent JSON tuple decoding in-process; option plumbing is inspected without rewriting imports or executing a host.
func TestFormatBlockThreadsEndOfLineIntoSortImports(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{
    "endOfLine":   "crlf",
    "sortImports": true,
  })
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }
  entry, ok := out["format/sort-imports"]
  if !ok {
    t.Fatal("format/sort-imports not present in output")
  }
  raw, err := json.Marshal(entry)
  if err != nil {
    t.Fatalf("marshal entry: %v", err)
  }
  var tuple []json.RawMessage
  if err := json.Unmarshal(raw, &tuple); err != nil || len(tuple) < 2 {
    t.Fatalf("entry not a [severity, opts] tuple: %v", err)
  }
  var o struct {
    EndOfLine string `json:"endOfLine"`
  }
  if err := json.Unmarshal(tuple[1], &o); err != nil {
    t.Fatalf("decode sort-imports opts: %v", err)
  }
  if o.EndOfLine != "crlf" {
    t.Errorf("endOfLine mismatch: want %q, got %q", "crlf", o.EndOfLine)
  }
}
