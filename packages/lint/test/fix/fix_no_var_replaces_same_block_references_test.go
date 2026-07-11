package linthost

import "testing"

// TestFixNoVarReplacesSameBlockReferences verifies no-var still rewrites a
// block-local `var` whose every reference stays inside the declaring block.
//
// Positive twin of the block-scope-escape decline: when no reference leaves
// the enclosing block's span, `let`'s narrower scoping is observationally
// identical, so the scope-containment gate must not over-decline the common
// block-local shape.
//
//  1. Parse an if-block declaring `var x` and reading it inside the same block.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesSameBlockReferences(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "if (Math.random() > 0.5) {\n  var x = 1;\n  JSON.stringify(x);\n}\n",
    "if (Math.random() > 0.5) {\n  let x = 1;\n  JSON.stringify(x);\n}\n",
  )
}
