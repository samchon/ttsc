package linthost

import "testing"

// TestNoUnreachableReportsOneRegionAndExemptsHoistedDeclarations verifies that
// no-unreachable reports a run of dead statements once and skips declarations
// that exist regardless of control flow.
//
// A `var` without an initializer hoists its binding, and interface and type
// alias declarations run nothing, so neither is dead code after a `return`.
// Consecutive dead statements form one region and are reported once over the
// whole run.
//
//  1. Run the rule over a function whose `return` is followed by an uninitialized
//     `var`, an interface and a type alias, and assert nothing is reported.
//  2. Run it over three dead statements in a row and assert one finding covering
//     all three.
//  3. Run it over a dead statement, an exempt `var`, then another dead statement
//     and assert two findings, and over an initialized `var` and assert one.
//
// @evidence contracts/testing.md#behavioral-verification no-unreachable must skip hoisted uninitialized vars and type-only declarations after a terminator, report a run of dead statements once with a range over the run, and split a run at an exempt declaration.
// @evidence contracts/testing.md#independent-expectations ECMAScript hoisting and the absence of runtime code in type declarations decide the exemptions, and ESLint reports each contiguous unreachable range once; the expected counts and the literal run text are authored.
// @evidence contracts/testing.md#distinguishing-cases The initialized var is the positive twin of the uninitialized var, the three-statement run contrasts with the two-region source that an exempt declaration splits, and the first source has no dead executable code at all.
// @evidence contracts/testing.md#execution-ownership TestNoUnreachableReportsOneRegionAndExemptsHoistedDeclarations parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoUnreachableReportsOneRegionAndExemptsHoistedDeclarations(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-unreachable",
    "function f(): number {\n  return 1;\n  var later: number;\n  interface Shape { a: number }\n  type Alias = Shape;\n}\nJSON.stringify(f);\n",
  )
  assertRuleFindingRanges(
    t,
    "no-unreachable",
    "function f(): void {\n  return;\n  a();\n  b();\n  c();\n}\nfunction a(): void {}\nfunction b(): void {}\nfunction c(): void {}\nJSON.stringify(f);\n",
    "a();\n  b();\n  c();",
  )
  assertRuleFindingRanges(
    t,
    "no-unreachable",
    "function f(): void {\n  return;\n  a();\n  var x: number;\n  b();\n}\nfunction a(): void {}\nfunction b(): void {}\nJSON.stringify(f);\n",
    "a();",
    "b();",
  )
  assertRuleFindingRanges(
    t,
    "no-unreachable",
    "function f(): void {\n  return;\n  var y = 1;\n}\nJSON.stringify(f);\n",
    "var y = 1;",
  )
}
