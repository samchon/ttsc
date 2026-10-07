package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeES5Option verifies `mode: "es5"` adds
// trailing commas to eligible lists while excluding function parameters.
//
// The es5 option includes arrays, objects, named specifiers, enums and type-level lists while excluding runtime parameter and argument commas. This mixed fixture pins an eligible array beside ineligible function parameters.
//
//  1. Parse a file mixing a multi-line array and a multi-line function
//     declaration, with `mode: "es5"` configured.
//  2. Apply the rule's findings.
//  3. Assert the array gains a trailing comma but the parameter list
//     does not.
//
// @evidence contracts/testing.md#behavioral-verification The array must gain its final comma while the multiline function parameters and existing call stay unchanged under es5. Full output catches ignoring the option or suppressing all list edits.
// @evidence contracts/testing.md#independent-expectations Official Prettier es5 policy permits array commas and excludes function parameter/call commas. The literal expected file preserves parameter names, return type, body and call while changing only the array.
// @evidence contracts/testing.md#distinguishing-cases A positive array and negative function declaration share one file and option. IncludesTypeLevelLists distinguishes tuple/type-parameter eligibility from runtime parameter eligibility.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeES5Option owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeES5Option(t *testing.T) {
  source := "const xs = [\n  1,\n  2\n];\n" +
    "function f(\n  a: number,\n  b: number\n): number { return a + b; }\n" +
    "f(1, 2);\n"
  want := "const xs = [\n  1,\n  2,\n];\n" +
    "function f(\n  a: number,\n  b: number\n): number { return a + b; }\n" +
    "f(1, 2);\n"
  assertFixSnapshotWithOptions(t, "format/trailing-comma", source, `{"mode":"es5"}`, want)
}
