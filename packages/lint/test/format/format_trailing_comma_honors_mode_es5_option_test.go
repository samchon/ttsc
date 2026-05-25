package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeES5Option verifies `mode: "es5"` adds
// trailing commas only to ES5-legal list positions.
//
// Prettier's `trailingComma: "es5"` adds commas only where ES5 grammar
// accepted them: array literals, object literals, and named imports /
// exports (prettier defaults `shouldPrintComma`'s level to `"es5"` for
// named specifiers — confirmed in prettier 3.x source at
// `src/language-js/print/module.js`). Function parameters, function
// calls, `new` arguments, and tuple types are all skipped. This
// scenario pins the function-parameter exclusion: a multi-line
// function with parameters that would otherwise gain a trailing comma
// stays unchanged, while a multi-line array literal in the same file
// does gain one.
//
//  1. Parse a file mixing a multi-line array and a multi-line function
//     declaration, with `mode: "es5"` configured.
//  2. Apply the rule's findings.
//  3. Assert the array gains a trailing comma but the parameter list
//     does not.
func TestFormatTrailingCommaHonorsModeES5Option(t *testing.T) {
  source := "const xs = [\n  1,\n  2\n];\n" +
    "function f(\n  a: number,\n  b: number\n): number { return a + b; }\n" +
    "f(1, 2);\n"
  want := "const xs = [\n  1,\n  2,\n];\n" +
    "function f(\n  a: number,\n  b: number\n): number { return a + b; }\n" +
    "f(1, 2);\n"
  assertFixSnapshotWithOptions(t, "formatTrailingComma", source, `{"mode":"es5"}`, want)
}
