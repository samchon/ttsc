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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run skips no-debugger when the parsed source is marked as a declaration, and the identical source reports one error without that marker.
// @evidence contracts/testing.md#independent-expectations The declaration-file eligibility contract excludes executable value rules; the literal debugger control independently establishes that the configured rule remains active on ordinary sources.
// @evidence contracts/testing.md#distinguishing-cases Only IsDeclarationFile changes between the two calls, distinguishing declaration filtering from a missing rule or universally disabled dispatch.
// @evidence contracts/testing.md#execution-ownership The actual no-debugger engine directly walks one parsed virtual source twice in one Go process; the input intentionally models the declaration marker rather than compiling a valid ambient declaration.
func TestEngineSkipsValueRulesOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "debugger;")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"no-debugger": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("value rule fired on a declaration file; got %d findings", len(findings))
  }
  file.IsDeclarationFile = false
  ordinary := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(ordinary) != 1 || ordinary[0].File != file || ordinary[0].Rule != "no-debugger" || ordinary[0].Severity != SeverityError {
    t.Fatalf("ordinary source control did not report debugger: %+v", ordinary)
  }
}
