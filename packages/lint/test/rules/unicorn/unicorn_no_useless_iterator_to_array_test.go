package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessIteratorToArray verifies
// unicorn/no-useless-iterator-to-array reports `[...arr.entries()]` inside a
// `for…of` head.
//
// The rule's syntactic match is the array-literal/spread/iterator-call
// container; the surrounding `for…of` is realistic context but not part of
// the predicate, so this fixture pins the smallest expression shape and the
// `entries` branch of the iterator-method switch.
//
// 1. Enable unicorn/no-useless-iterator-to-array via an expect annotation.
// 2. Iterate `[...arr.entries()]` with a `for…of` loop.
// 3. Assert the outer array literal is reported.
func TestRuleCorpusUnicornNoUselessIteratorToArray(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-useless-iterator-to-array.ts", "const arr = [1, 2];\n// expect: unicorn/no-useless-iterator-to-array error\nfor (const e of [...arr.entries()]) { void e; }\n")
}
