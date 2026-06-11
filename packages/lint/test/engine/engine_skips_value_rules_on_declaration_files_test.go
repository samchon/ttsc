package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineSkipsValueRulesOnDeclarationFiles verifies the engine does not
// dispatch value-level rules on declaration-file sources.
//
// Replaces the previous walk-everything contract (issue #177): a `.d.ts`
// carries no executable code, so a rule like `no-debugger` can never produce
// a legitimate finding there and dispatching to it is pure overhead on
// declaration-heavy projects. Rules participate in declaration files only
// through the FormatRule marker, the declarationFileRule interface, or the
// curated `declarationFileRuleNames` allowlist.
//
// 1. Parse a source containing a debugger statement.
// 2. Mark it as a declaration source file.
// 3. Run the engine with `no-debugger` and assert zero findings.
func TestEngineSkipsValueRulesOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "debugger;")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"no-debugger": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("value rule fired on a declaration file; got %d findings", len(findings))
  }
}
