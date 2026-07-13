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
func TestNoVarSkipsAmbientDeclareVar(t *testing.T) {
  file := parseTS(t, "declare var ambient: string;\nJSON.stringify(typeof ambient);\n")
  findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("noVar reported ambient declare var: %d findings", len(findings))
  }
}
