package linthost

import "testing"

// TestFormatSortImportsUnsafeOptionReordersRuntimeImports verifies the explicit
// unsafe option restores declaration-level sorting for runtime dependencies.
//
// The option is deliberately named for its semantic cost. This positive twin
// proves it controls the runtime guard rather than becoming a documented flag
// that the implementation silently ignores.
//
//  1. Parse two bare runtime imports in reverse lexical order.
//  2. Enable unsafeSortRuntimeImports.
//  3. Assert the declarations reorder alphabetically.
//  4. Assert the same reversed source produces no findings without unsafe permission.
//
// @evidence contracts/testing.md#behavioral-verification Explicit unsafe permission must reorder bare a before z; the identical reversed input must emit no findings with safe defaults.
// @evidence contracts/testing.md#independent-expectations The public unsafe option permits alphabetical runtime dependency sorting, while safe mode retains authored evaluation order. Independently authored literal output and zero-finding input fix both sides of that permission contract.
// @evidence contracts/testing.md#distinguishing-cases The exact same two bare dependencies distinguish absent versus explicit runtime permission. Type-only default sorting and local named-list sorting exercise separate safe operations.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsUnsafeOptionReordersRuntimeImports owns its literal bare-import source and complete unsafe-mode reorder output plus its identical-input safe-mode negative in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsUnsafeOptionReordersRuntimeImports(t *testing.T) {
  source := "import \"./z\";\n" +
    "import \"./a\";\n"
  expected := "import \"./a\";\n" +
    "import \"./z\";\n"
  assertFixSnapshotWithOptions(
    t,
    "format/sort-imports",
    source,
    `{"unsafeSortRuntimeImports":true}`,
    expected,
  )
  assertRuleSkipsSource(t, "format/sort-imports", source)
}
