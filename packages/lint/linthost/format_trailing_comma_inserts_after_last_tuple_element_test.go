package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastTupleElement verifies the rule
// covers tuple types in addition to runtime arrays.
//
// Tuple types share brackets with runtime arrays but declare ordered types. Their final comma must not change tuple positions or the surrounding runtime value.
//
// 1. Parse a source file with one multi-line tuple type.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The tuple type must gain a comma after string while retaining its number/string order and the existing runtime pair value.
// @evidence contracts/testing.md#independent-expectations The authored literal expected type specifies only the final comma for this broken tuple while independently preserving element positions and the value declaration. This direct unit does not execute a reference formatter.
// @evidence contracts/testing.md#distinguishing-cases Type-level tuple elements differ from runtime array elements. The ES5 type-level host supplies option coverage and the runtime-array host supplies the sibling syntax owner.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastTupleElement owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastTupleElement(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "type Pair = [\n  number,\n  string\n];\nconst p: Pair = [1, \"two\"];\n",
    "type Pair = [\n  number,\n  string,\n];\nconst p: Pair = [1, \"two\"];\n",
  )
}
