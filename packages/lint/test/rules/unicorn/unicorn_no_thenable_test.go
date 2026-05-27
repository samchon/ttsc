package linthost

import "testing"

// TestRuleCorpusUnicornNoThenable verifies unicorn/no-thenable reports an
// object-literal method named `then`.
//
// A method named `then` is the most common way to accidentally make a plain
// object thenable. The rule dispatches on every property-defining node form
// and only checks the property's name; the fixture uses a method declaration
// to pin the dispatch path while keeping the minimal positive case readable.
//
// 1. Enable unicorn/no-thenable via an expect annotation.
// 2. Define an object literal with a method named `then`.
// 3. Assert the method declaration is reported.
func TestRuleCorpusUnicornNoThenable(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-thenable.ts", "const o = {\n  // expect: unicorn/no-thenable error\n  then() {\n    return 1;\n  },\n};\nvoid o;\n")
}
