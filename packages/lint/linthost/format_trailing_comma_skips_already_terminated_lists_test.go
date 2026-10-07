package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsAlreadyTerminatedLists verifies idempotence.
//
// An allowed comma is already canonical and must not be reported again. Switching to none changes that same punctuation policy and must remove each final comma.
//
// 1. Parse multi-line lists that already end in trailing commas.
// 2. Run the engine with formatTrailingComma enabled.
// 3. Require all-mode silence and exact none-mode removal on the same source.
//
// @evidence contracts/testing.md#behavioral-verification Canonical multiline arrays and objects must produce no findings under all mode. Under none, the same source must lose both final commas while retaining its interior separators and item values.
// @evidence contracts/testing.md#independent-expectations The all/none option policies independently prescribe keeping or removing terminal commas. Literal expected full output fixes both lists without consulting an implementation shortcut or assuming a cascade pass count.
// @evidence contracts/testing.md#distinguishing-cases The original all-mode fixed point remains, paired with none-mode full removal on the exact same two lists. Missing-comma array/object hosts cover insertion rather than canonical input.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsAlreadyTerminatedLists owns the direct Engine all-mode absence assertion and complete none-mode removal output in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native builds or product-host children.
func TestFormatTrailingCommaSkipsAlreadyTerminatedLists(t *testing.T) {
  source := "const xs = [\n  1,\n  2,\n];\nconst obj = {\n  a: 1,\n  b: 2,\n};\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/trailing-comma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
  assertFixSnapshotWithOptions(t, "format/trailing-comma", source, `{"mode":"none"}`,
    "const xs = [\n  1,\n  2\n];\nconst obj = {\n  a: 1,\n  b: 2\n};\n")
}
