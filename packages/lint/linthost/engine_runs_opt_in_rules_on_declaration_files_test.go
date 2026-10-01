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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run retains the typescript/no-explicit-any error on a marked declaration source and reports the authored any token range.
// @evidence contracts/testing.md#independent-expectations The literal declare const x:any annotation independently violates no-explicit-any, and its token range [17,20) identifies the expected diagnostic.
// @evidence contracts/testing.md#distinguishing-cases A curated type-annotation rule on a marked declaration complements skipped executable no-debugger and admitted format/semi cases.
// @evidence contracts/testing.md#execution-ownership A real parsed virtual source and actual NewEngine/Engine.Run run in one Go process with IsDeclarationFile set; no compiler child or consumer installation is needed.
func TestEngineRunsOptInRulesOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "declare const x: any;")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("opt-in rule did not fire on a declaration file; got %d findings", len(findings))
  }
  finding := findings[0]
  if finding.File != file || finding.Rule != "typescript/no-explicit-any" || finding.Severity != SeverityError || finding.Pos != 17 || finding.End != 20 {
    t.Fatalf("declaration annotation diagnostic changed: %+v", finding)
  }
}
