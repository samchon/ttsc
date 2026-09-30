package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatClauseJoinEmitsNoShiftWhenTheColumnIsUnchanged verifies a hoisted body already at the header's column produces only the join.
//
// A zero delta must produce no indentation edit at all. Emitting a same-text
// replacement for every continuation line would make the finding contend with
// `format/indent` for bytes neither rule needs to change, and the host drops a
// whole finding whose edits collide.
//
//  1. Parse a label whose body already starts at the label's own column.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the join lands and the body's interior is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must join the label while leaving continuation indentation untouched. The original complete snapshot plus exactly one finding with one exact newline-to-space edit detects redundant same-text indentation edits that a snapshot alone would miss.
// @evidence contracts/testing.md#independent-expectations The label and loop both begin at column zero, so the required movement is only the label newline. Literal byte positions cover outer: through its newline, and the loop body bytes remain independent expected content.
// @evidence contracts/testing.md#distinguishing-cases The multiline loop is a join positive with zero indentation delta; direct edit-count assertions forbid extra continuation edits. ReindentsAHoistedLabeledBlock supplies the adjacent nonzero-delta case.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinEmitsNoShiftWhenTheColumnIsUnchanged owns its source and exact direct Engine findings in the public Go unit population. The owning rule and syntax-only edit harness execute in process without a consumer install, native artifact build or real product host.
func TestFormatClauseJoinEmitsNoShiftWhenTheColumnIsUnchanged(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\nfor (const item of items) {\n  visit(item);\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: for (const item of items) {\n  visit(item);\n}\n",
  )
  source := "outer:\nfor (const item of items) {\n  visit(item);\n}\n"
  file := parseTSFile(t, "/virtual/main.ts", source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/clause-join": SeverityError},
    Options: RuleOptionsMap{"format/clause-join": []byte(`{"printWidth":80,"tabWidth":2}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected only the label join, got %d: %v", len(findings), findings)
  }
  finding := findings[0]
  if finding.Rule != "format/clause-join" || !finding.IsFormat || len(finding.Fix) != 1 {
    t.Fatalf("zero-delta body must not emit indentation edits: %+v", finding)
  }
  edit := finding.Fix[0]
  if edit.Pos != len("outer:") || edit.End != len("outer:\n") || edit.Text != " " {
    t.Fatalf("expected only the label newline to change: %+v", edit)
  }
}
