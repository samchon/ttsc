package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoVarSkipsDeclarationFileVars verifies ambient declaration variables do
// not trip the runtime noVar rule.
//
// TypeScript declaration files use `var` to describe globals and namespace
// exports. This unit pins the native declaration-file allowance rather than
// upstream ESLint parity. It directly supplies the classification used for
// declaration sources; it does not discover `.d.ts` roots through tsconfig.
//
// 1. Parse a declaration-like source containing `var`.
// 2. Mark the source file as a declaration file.
// 3. Run noVar and assert no finding is emitted.
//
// @evidence contracts/testing.md#behavioral-verification Engine stays silent for declaration SourceFiles with explicit and implicit ambient var forms; the identical implicit source reports once when its declaration-file flag is absent.
// @evidence contracts/testing.md#independent-expectations The declaration-file classification is a legitimate parser/engine input describing ambient globals, not a repository file-presence assertion.
// @evidence contracts/testing.md#distinguishing-cases The original declare-var fixture is retained; an otherwise identical var source with and without the declaration-file flag isolates that guard from the ambient modifier. TestNoVarSkipsAmbientDeclareVar separately owns modifier inheritance.
// @evidence contracts/testing.md#execution-ownership TestNoVarSkipsDeclarationFileVars three in-memory parseTS sources are run through NewEngine(no-var).Run: the declare-var and implicit-var sources with IsDeclarationFile set must yield zero findings and the identical implicit source without the flag must yield one no-var finding. No temp project, consumer install or product host is involved.
func TestNoVarSkipsDeclarationFileVars(t *testing.T) {
  file := parseTS(t, "declare var value: string;\n")
  file.IsDeclarationFile = true
  findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("noVar reported ambient declaration vars: %d findings", len(findings))
  }
  implicit := parseTS(t, "var value: string;\n")
  implicit.IsDeclarationFile = true
  if findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{implicit}, nil); len(findings) != 0 {
    t.Fatalf("noVar reported implicit declaration-file var: %+v", findings)
  }
  ordinary := parseTS(t, "var value: string;\n")
  if findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{ordinary}, nil); len(findings) != 1 || findings[0].Rule != "no-var" {
    t.Fatalf("noVar did not distinguish ordinary var from declaration-file var: %+v", findings)
  }
}
