package linthost

import "testing"

// TestRuleCorpusUnicornPreferClasslistToggle verifies the rule reports
// an `if (cond) el.classList.add(name); else el.classList.remove(name);`
// pair that could be collapsed to `el.classList.toggle(name, cond)`.
//
// The fixture pins the two-branch shape the rule exists to discourage:
// matching receiver text (`el.classList`) on both calls, matching
// argument text (`"active"`), and opposite method names. The if-node
// is the report anchor because the entire two-statement rewrite is
// what the suggestion replaces.
//
// 1. Enable unicorn/prefer-classlist-toggle via an expect annotation.
// 2. Open an if/else where then-branch calls `.classList.add("active")`
//    and else-branch calls `.classList.remove("active")`.
// 3. Assert the if-statement is reported.
func TestRuleCorpusUnicornPreferClasslistToggle(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-classlist-toggle.ts", "declare const el: Element;\ndeclare const cond: boolean;\n// expect: unicorn/prefer-classlist-toggle error\nif (cond) {\n  el.classList.add(\"active\");\n} else {\n  el.classList.remove(\"active\");\n}\n")
}
