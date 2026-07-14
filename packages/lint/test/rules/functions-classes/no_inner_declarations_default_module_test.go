package linthost

import "testing"

// TestNoInnerDeclarationsDefaultAllowsModuleBlockFunctions verifies ESM strictness.
//
// The parser's external-module indicator makes the whole source strict. The
// rule must use that AST fact so nested functions are allowed without relying
// on an extension, a filename convention, or a textual import search.
//
// 1. Mark a source as ESM and place functions in several nested blocks.
// 2. Include named and default exported root function declarations.
// 3. Assert the default rule emits no diagnostics.
func TestNoInnerDeclarationsDefaultAllowsModuleBlockFunctions(t *testing.T) {
  assertNoInnerDeclarationsCase(t, "default-module.ts", `export {};

if (moduleCondition) {
  function moduleNested() {}
}

function outer() {
  if (innerCondition) {
    function functionNested() {}
  }
}

export function exportedRoot() {}
export default function exportedDefaultRoot() {}
`, "")
}
