package linthost

import "testing"

// TestFixNoVarReplacesSameBlockReferences verifies no-var still rewrites a
// block-local `var` whose every reference stays inside the declaring block.
//
// Positive twin of the block-scope-escape decline: this initialized module
// binding is read only later in the same block, with no direct eval or
// redeclaration. Its narrower let scope preserves the fixture's read, so
// the containment gate must not over-decline this otherwise safe case.
//
//  1. Parse an if-block declaring `var x` and reading it inside the same block.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes x when its references stay in the same if block.
// @evidence contracts/testing.md#independent-expectations The literal let result preserves the condition and body read; no reference escapes the lexical block.
// @evidence contracts/testing.md#distinguishing-cases The same block shape with an external read is the separate no-fix escape case.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesSameBlockReferences calls assertFixSnapshot using the contained if-block fixture.
func TestFixNoVarReplacesSameBlockReferences(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "if (Math.random() > 0.5) {\n  var x = 1;\n  JSON.stringify(x);\n}\nexport {};\n",
    "if (Math.random() > 0.5) {\n  let x = 1;\n  JSON.stringify(x);\n}\nexport {};\n",
  )
}
