package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRunsOptInRulesOnDeclarationFiles verifies a rule on the
// declaration-file allowlist still fires on `.d.ts` sources.
//
// The negative twin of the declaration-file skip (issue #177):
// `typescript/no-explicit-any` inspects type annotations — precisely the
// grammar declaration files are made of — so the skip must not silence it.
// If the allowlist wiring regressed, declaration-heavy projects would lose
// these findings without any error.
//
//  1. Parse `declare const x: any;`.
//  2. Mark it as a declaration source file.
//  3. Run the engine with `typescript/no-explicit-any` and assert the
//     finding is reported.
func TestEngineRunsOptInRulesOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "declare const x: any;")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("opt-in rule did not fire on a declaration file; got %d findings", len(findings))
  }
}
