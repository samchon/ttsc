package linthost

import "testing"

// TestFixNoVarPreservesScriptGlobalObjectBindings verifies global properties survive automatic fixing.
//
// Script var creates a property on the global object even when the current file
// never reads that property. Module and function bindings have no such exposure.
//
// 1. Check root, nested-block and loop declarations in scripts.
// 2. Require reporting without automatic edits, including reflection reads.
// 3. Preserve the same ordinary edit in explicit modules and functions.
//
// @evidence contracts/testing.md#behavioral-verification The real no-var rule withholds script-global edits and the fixer rewrites equivalent local declarations.
// @evidence contracts/testing.md#independent-expectations ECMAScript global var creates a global-object property whereas let creates a declarative binding; module/function var does not create that property.
// @evidence contracts/testing.md#distinguishing-cases Root/block/loop hoisting and globalThis reflection contrast with explicit module and function ownership.
// @evidence contracts/testing.md#execution-ownership This unit invokes actual Engine and disk edit helpers in one Go process without a native host.
func TestFixNoVarPreservesScriptGlobalObjectBindings(t *testing.T) {
  for _, source := range []string{
    "var x=42;",
    "var x=42;globalThis.x;",
    "var x=42;this.x;",
    "if(true){var x=42;}",
    "for(var x=0;x<1;x++){}",
  } {
    t.Run(source, func(t *testing.T) { assertNoFixSnapshot(t, "no-var", source) })
  }
  assertFixSnapshot(t, "no-var", "export {};var x=42;", "export {};let x=42;")
  assertFixSnapshot(t, "no-var", "function f(){var x=42;return x;}", "function f(){let x=42;return x;}")
}
