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
//
// @evidence contracts/testing.md#behavioral-verification Engine requires no findings for nested ESM functions and named/default exported root declarations.
// @evidence contracts/testing.md#independent-expectations An actual export statement establishes module strictness independently of filename or extension; default block-function allowance follows that language context.
// @evidence contracts/testing.md#distinguishing-cases Module blocks and function-depth blocks stay clean alongside export roots; the default strict-context test owns script and misleading-string contrasts.
// @evidence contracts/testing.md#execution-ownership TestNoInnerDeclarationsDefaultAllowsModuleBlockFunctions is selected in the shared Go unit population. It calls assertNoInnerDeclarationsCase for default-module.ts, using the parsed source module indicator and owning Engine. No consumer install, native artifact build or real host runs.
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
