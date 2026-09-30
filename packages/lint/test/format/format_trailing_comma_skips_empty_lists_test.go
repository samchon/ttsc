package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsEmptyLists verifies the rule shrugs at empty
// lists.
//
// Empty lists have no final item or comma position. Normalizing a neighboring nonempty list must not create punctuation in any of them.
//
// 1. Parse empty function declarations, calls, and array literals.
// 2. Run the engine with formatTrailingComma enabled.
// 3. Require zero findings, then normalize a neighboring nonempty array while
//    preserving every original empty list.
//
// @evidence contracts/testing.md#behavioral-verification Empty function, array, object, call and new lists must produce no findings. A neighboring nonempty multiline array must still gain its comma while every original empty list stays byte-identical.
// @evidence contracts/testing.md#independent-expectations An empty list has no last item after which a comma could be inserted. The literal neighboring array output follows the supported all-mode policy and retains the complete original empty-list source.
// @evidence contracts/testing.md#distinguishing-cases The original empty population includes both single-line and multiline lists. A nonempty multiline array in the same source supplies an adjacent positive, distinguishing empty-list safety from a disabled rule.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsEmptyLists owns the direct Engine empty-list absence assertion and neighboring-array complete output in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native builds or product-host children.
func TestFormatTrailingCommaSkipsEmptyLists(t *testing.T) {
  source := "function noop() {}\nfunction nullary(\n) {\n}\nconst empty = [];\nconst arr = [\n];\nconst obj = {};\nJSON.stringify();\nnew Date();\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/trailing-comma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
  assertFixSnapshot(t, "format/trailing-comma", "const nearby = [\n  value\n];\n"+source, "const nearby = [\n  value,\n];\n"+source)
}
