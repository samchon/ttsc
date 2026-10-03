package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoVarSkipsAmbientDeclareVar verifies `declare var` statements in a
// regular .ts file do not trip the noVar rule.
//
// An ambient `declare var` describes an existing global binding rather than
// creating one; this unit pins the maintained native ambient allowance rather
// than ESLint parity. The guard reads the Ambient modifier off the owning
// VariableStatement after dispatch moved to KindVariableDeclarationList
// (issue #409) the modifier lives on the list's PARENT, so this pins that
// the refactored owner lookup still finds it.
//
// 1. Parse a non-declaration source containing `declare var`.
// 2. Run noVar over the file.
// 3. Assert no finding is emitted.
//
// @evidence contracts/testing.md#behavioral-verification Engine emits zero no-var findings for a declare var statement in a regular TypeScript source file.
// @evidence contracts/testing.md#independent-expectations The authored zero result pins the native ambient allowance for a declaration without runtime binding creation. It does not establish ESLint parity: upstream exempts declare-global members rather than all ambient declarations.
// @evidence contracts/testing.md#distinguishing-cases Regular-file declare var owns modifier inheritance; the corpus fixture no-var.ts owns ordinary runtime var, and the declaration-file case owns file classification.
// @evidence contracts/testing.md#execution-ownership TestNoVarSkipsAmbientDeclareVar parseTS parses the declare-var source in memory and NewEngine(no-var).Run executes the rule directly over it; the test compares the finding count with zero. No temp project, consumer install or product host is involved.
func TestNoVarSkipsAmbientDeclareVar(t *testing.T) {
  file := parseTS(t, "declare var ambient: string;\nJSON.stringify(typeof ambient);\n")
  findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("noVar reported ambient declare var: %d findings", len(findings))
  }
}
