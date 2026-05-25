package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastTupleElement verifies the rule
// covers tuple types in addition to runtime arrays.
//
// Tuple types share `[ ... ]` syntax with array literals but live in the
// type space. The dispatcher must reach KindTupleType too; otherwise the
// formatter would treat type-level tuples inconsistently with value-level
// arrays and surprise users every time they declared one across multiple
// lines.
//
// 1. Parse a source file with one multi-line tuple type.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
func TestFormatTrailingCommaInsertsAfterLastTupleElement(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "type Pair = [\n  number,\n  string\n];\nconst p: Pair = [1, \"two\"];\n",
    "type Pair = [\n  number,\n  string,\n];\nconst p: Pair = [1, \"two\"];\n",
  )
}
