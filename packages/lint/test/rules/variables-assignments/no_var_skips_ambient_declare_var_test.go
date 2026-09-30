package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoVarSkipsAmbientDeclareVar verifies `declare var` statements in a
// regular .ts file do not trip the noVar rule.
//
// An ambient `declare var` describes an existing global binding rather than
// creating one, so ESLint-parity noVar leaves it alone. The guard reads the
// Ambient modifier off the owning VariableStatement; after the rule moved
// its dispatch from KindVariableStatement to KindVariableDeclarationList
// (issue #409) the modifier lives on the list's PARENT, so this pins that
// the refactored owner lookup still finds it.
//
// 1. Parse a non-declaration source containing `declare var`.
// 2. Run noVar over the file.
// 3. Assert no finding is emitted.
//
// @evidence contracts/testing.md#behavioral-verification Engine emits zero no-var findings for a declare var statement in a regular TypeScript source file.
// @evidence contracts/testing.md#independent-expectations Ambient declarations describe existing globals rather than create runtime var bindings; that distinction establishes the independent clean expectation.
// @evidence contracts/testing.md#distinguishing-cases Regular-file declare var owns modifier inheritance; TestRuleCorpusNoVar owns ordinary runtime var, and the declaration-file case owns file classification.
// @evidence contracts/testing.md#execution-ownership TestNoVarSkipsAmbientDeclareVar owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestNoVarSkipsAmbientDeclareVar(t *testing.T) {
  file := parseTS(t, "declare var ambient: string;\nJSON.stringify(typeof ambient);\n")
  findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("noVar reported ambient declare var: %d findings", len(findings))
  }
}
