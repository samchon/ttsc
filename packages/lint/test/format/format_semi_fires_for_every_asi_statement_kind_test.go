package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiFiresForEveryAsiStatementKind verifies formatSemi covers the
// full ASI statement surface.
//
// The rule's Visits() list is the load-bearing contract: dropping a kind
// silently strips its diagnostics and fixes. This scenario walks one
// terminator-less example per declared kind and asserts the rule fires on
// each, so a future refactor that thins the kind list cannot regress without
// updating this fixture.
//
// 1. Parse a source file with one of each ASI statement kind missing `;`.
// 2. Run the engine with formatSemi enabled.
// 3. Assert the finding count matches the declared kind count.
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
    if edit.Pos != edit.End || edit.Text != ";" {
      t.Fatalf("expected zero-width `;` edit, got %+v", edit)
    }
  }

  // Sanity: parser reproduces real AST. Confirms the fixture isn't
  // silently degrading to JSDocText or similar.
  if file.Statements == nil || len(file.Statements.Nodes) < 8 {
    t.Fatalf("parser produced unexpected statement count: %d", len(file.Statements.Nodes))
  }
  _ = shimast.KindVariableStatement // anchor the import.
}
