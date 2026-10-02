package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiPreferNeverStripsMemberWithSpace verifies that a type
// member whose terminator is preceded by whitespace is still stripped.
// Only the punctuation is removed; the preceding space is outside the edit.
// This valid parsed fixture does not establish the separate parser-recovery
// fallback that scans beyond the member range.
//
//  1. Parse an interface whose member is written "a: number ;", with a
//     space before the terminator.
//  2. Run format/semi configured `prefer: "never"`.
//  3. Assert one finding: the member terminator is redundant and gets
//     removed.
//  4. Assert the fixed output drops only the `;` itself; the rule's edit
//     is a single-byte removal, so the pre-terminator space remains.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove a redundant interface member semicolon separated from its number annotation by a space, retaining that space and the annotation.
// @evidence contracts/testing.md#independent-expectations The independently authored full output removes only the literal punctuation byte and leaves all preceding whitespace unchanged; the finding count is supplemented by exact fixed source.
// @evidence contracts/testing.md#distinguishing-cases One whitespace-separated member is the changed positive beside ordinary adjacent-terminator stripping and required-separator negatives; this fixture does not establish parser-recovery fallback coverage.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverStripsMemberWithSpace is a public Go unit selected by the lint semantic-unit Evidence claim. This entry parses literal source and directly invokes Engine.Run with the owning semicolon rule; it also uses the syntax-only fixer harness for the exact output in the same Go process, without consumer installation, a native product build or host execution.
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
