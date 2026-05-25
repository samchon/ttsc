package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterParameterPropertyInConstructor verifies
// the rule fires correctly when the last constructor parameter is a
// TypeScript parameter property (carrying `public`/`private`/`protected`/
// `readonly`/`override`).
//
// Parameter properties stack TS modifiers in front of the binding name; the
// modifiers and the type annotation are children of the same
// `ParameterDeclaration`, so `last.End()` still lands past every code byte
// regardless of how many modifiers precede the parameter. The
// existing constructor-parameter test pins a plain `public x: number, public
// y: number` pair, but this case pins the modifier-stacked variant
// (`public readonly`, `private`) end-to-end so a future refactor that
// mis-handled modifier spans would surface here.
//
//  1. Parse a source file with one class whose constructor declares two
//     multi-line parameter properties with mixed modifiers.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter property.
func TestFormatTrailingCommaInsertsAfterParameterPropertyInConstructor(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "class Point {\n  constructor(\n    public readonly x: number,\n    private y: number\n  ) {}\n}\nPoint;\n",
    "class Point {\n  constructor(\n    public readonly x: number,\n    private y: number,\n  ) {}\n}\nPoint;\n",
  )
}
