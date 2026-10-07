package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatIndentNormalizesSameLineDecoratedMember verifies a member whose
// decorator and declaration share one physical line is re-indented exactly
// once, to member depth.
//
// For `@Column() name: string` the decorator's End() and the declaration
// start resolve to the same physical line the decorator pass already
// handles, so the second re-indent must be a no-op rather than a duplicate
// or conflicting edit. This guards the same-line decorator boundary.
//
//  1. Parse a class with a single same-line decorated member at column 0.
//  2. Apply the format/indent finding through the disk-backed fixer.
//  3. Assert the one line lands at two spaces and is otherwise untouched.
//  4. Require one finding with exactly one insertion before the decorator.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must insert two spaces before the same-line decorator/member exactly once. The original full snapshot plus one finding with one exact zero-width insertion distinguishes redundant or conflicting duplicate edits that equal final bytes could hide.
// @evidence contracts/testing.md#independent-expectations The supported class-member column independently requires only two leading spaces; decorator and declaration already share one physical line. Literal byte offsets identify its start, and all member content must remain unchanged.
// @evidence contracts/testing.md#distinguishing-cases This positive puts both decorator and declaration on the same line at column zero. Direct exact edit-count/range/text assertions distinguish it from the separate-line host requiring two different indentation edits.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentNormalizesSameLineDecoratedMember owns its snapshot and direct parsed-source Engine assertions in the public Go unit population. The owning operation and edit harness execute in process without consumer installation, native artifact production or a real product host.
func TestFormatIndentNormalizesSameLineDecoratedMember(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\n@Column() name: string = \"\";\n}\n",
    "class User {\n  @Column() name: string = \"\";\n}\n",
  )
  source := "class User {\n@Column() name: string = \"\";\n}\n"
  file := parseTSFile(t, "/virtual/main.ts", source)
  resolver := InlineRuleResolver{Rules: RuleConfig{"format/indent": SeverityError}}
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one indentation finding, got %d: %v", len(findings), findings)
  }
  finding := findings[0]
  if finding.Rule != "format/indent" || !finding.IsFormat || len(finding.Fix) != 1 {
    t.Fatalf("same-line decorator must not create duplicate indentation edits: %+v", finding)
  }
  edit := finding.Fix[0]
  if edit.Pos != len("class User {\n") || edit.End != edit.Pos || edit.Text != "  " {
    t.Fatalf("expected one insertion before the decorator: %+v", edit)
  }
}
