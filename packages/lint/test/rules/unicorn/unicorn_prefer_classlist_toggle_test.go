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
//  1. Enable unicorn/prefer-classlist-toggle via an expect annotation.
//  2. Open an if/else where then-branch calls `.classList.add("active")`
//     and else-branch calls `.classList.remove("active")`.
//  3. Assert the if-statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies symmetric classList add and remove calls occupy opposite branches; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-classlist-toggle annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; toggle accepts the class and explicit boolean condition. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferClasslistToggle is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferClasslistToggle(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-classlist-toggle.ts", "declare const el: Element;\ndeclare const cond: boolean;\n// expect: unicorn/prefer-classlist-toggle error\nif (cond) {\n  el.classList.add(\"active\");\n} else {\n  el.classList.remove(\"active\");\n}\n")
  assertRuleSkipsSource(t, "unicorn/prefer-classlist-toggle", "declare const el: Element; declare const cond: boolean; el.classList.toggle(\"active\", cond);\n")
}
