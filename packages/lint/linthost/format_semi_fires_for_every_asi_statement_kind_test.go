package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiFiresForEveryAsiStatementKind verifies formatSemi covers the
// fourteen ASI statement and class-field spellings in this fixture.
//
// The rule's Visits() list is the load-bearing contract: dropping a kind
// silently strips its diagnostics and fixes. This scenario walks one
// terminator-less example per declared kind and asserts the rule fires on
// each, so a future refactor that thins the kind list cannot regress without
// updating this fixture.
//
// 1. Parse a source file with one of each ASI statement kind missing `;`.
// 2. Run the engine with formatSemi enabled.
// 3. Assert one classified semicolon insertion at each literal statement ending.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must emit one correctly classified zero-width semicolon insertion at each of fourteen independently identified statement/member endings, detecting a missing kind disguised by a duplicate elsewhere.
// @evidence contracts/testing.md#independent-expectations Literal unique fixture statement markers independently determine their insertion offsets; expected zero-width semicolon bytes and formatter classification follow the default rule contract, not Visits metadata.
// @evidence contracts/testing.md#distinguishing-cases This host owns all fourteen local import/export/declaration/expression/control/debugger/class-field cases. Every exact insertion is consumed once; already-terminated statements own the adjacent no-finding negative, and dedicated type-member tests own additional member kinds.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiFiresForEveryAsiStatementKind is a selected public Go unit under the lint semantic-unit Evidence claim. The entry parses literal fixture source and directly calls Engine.Run with the owning semicolon rule, observing its findings and edits in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiFiresForEveryAsiStatementKind(t *testing.T) {
  // Each line is exactly one statement that ASI would terminate. The
  // class body holds the PropertyDeclaration case; the test imports use
  // a synthetic module specifier so the parser accepts them without a
  // resolved program.
  source := `import x from "x"
import y = require("y")
export * from "z"
export = x
let a = 1
type Alias = number
class Wrap { field = 1 }
JSON.stringify(a)
function loop() {
  do {} while (false)
  for (;;) { break }
  for (;;) { continue }
  return 1
  throw 1
}
debugger
`
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/semi": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)

  // 14 ASI-terminated kinds in the fixture: import, importEquals,
  // exportDecl, exportAssignment, varStmt, typeAlias, propertyDecl,
  // exprStmt, doStmt, break, continue, return, throw, debugger.
  const wantKinds = 14
  if len(findings) != wantKinds {
    t.Fatalf("want %d findings (one per ASI kind), got %d", wantKinds, len(findings))
  }
  expectedInsertions := map[int]string{}
  for _, marker := range []string{
    "import x from \"x\"", "import y = require(\"y\")", "export * from \"z\"", "export = x",
    "let a = 1", "type Alias = number", "field = 1", "JSON.stringify(a)",
    "do {} while (false)", "break", "continue", "return 1", "throw 1", "debugger",
  } {
    offset := strings.Index(source, marker)
    if offset < 0 || strings.Contains(source[offset+1:], marker) {
      t.Fatalf("literal fixture marker must occur exactly once: %q", marker)
    }
    expectedInsertions[offset+len(marker)] = marker
  }
  // Every finding must be tagged as a format-rule finding so the fix
  // filter routes it to the format subcommand.
  for _, finding := range findings {
    if !finding.IsFormat {
      t.Fatalf("expected IsFormat=true on %s @ %d", finding.Rule, finding.Pos)
    }
    if finding.Rule != "format/semi" {
      t.Fatalf("unexpected rule %q in finding", finding.Rule)
    }
    if len(finding.Fix) != 1 {
      t.Fatalf("expected exactly one edit per finding, got %d", len(finding.Fix))
    }
    edit := finding.Fix[0]
    if _, ok := expectedInsertions[edit.Pos]; !ok {
      t.Fatalf("unexpected or duplicate insertion at %d: %+v", edit.Pos, edit)
    }
    delete(expectedInsertions, edit.Pos)
    if edit.Pos != edit.End || edit.Text != ";" {
      t.Fatalf("expected zero-width `;` edit, got %+v", edit)
    }
  }

  if len(expectedInsertions) != 0 {
    t.Fatalf("missing literal statement insertions: %v", expectedInsertions)
  }

  // Sanity: parser reproduces real AST. Confirms the fixture isn't
  // silently degrading to JSDocText or similar.
  if file.Statements == nil || len(file.Statements.Nodes) < 8 {
    t.Fatalf("parser produced unexpected statement count: %d", len(file.Statements.Nodes))
  }
}
