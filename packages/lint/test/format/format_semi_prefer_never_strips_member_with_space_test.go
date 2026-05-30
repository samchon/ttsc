package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiPreferNeverStripsMemberWithSpace verifies that a type
// member whose terminator is preceded by whitespace is still stripped,
// exercising the whitespace-skip fallback in stripMemberSemicolon (the
// branch that scans horizontal whitespace forward from End() to locate a
// `;` that does not sit directly at End()-1).
//
//  1. Parse an interface whose member is written "a: number ;", with a
//     space before the terminator.
//  2. Run format/semi configured `prefer: "never"`.
//  3. Assert one finding: the member terminator is redundant and gets
//     removed.
//  4. Assert the fixed output drops only the `;` itself; the rule's edit
//     is a single-byte removal, so the pre-terminator space remains.
func TestFormatSemiPreferNeverStripsMemberWithSpace(t *testing.T) {
  const optionsJSON = `{"prefer":"never"}`
  source := "interface I {\n" +
    "  a: number ;\n" +
    "}\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/semi": SeverityError},
    Options: RuleOptionsMap{
      "format/semi": json.RawMessage(optionsJSON),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected 1 finding (the space-separated member terminator is redundant), got %d:\n%v",
      len(findings), findings)
  }
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    source,
    optionsJSON,
    "interface I {\n  a: number \n}\n",
  )
}
