package linthost

import "testing"

// TestNoDupeClassMembersAllowsTypeScriptOverloadSignatures verifies that
// method overload signatures and their implementation are one member, not
// duplicates.
//
// A TypeScript overload set declares the same method name several times, with
// bodiless signatures followed by one implementation. typescript-eslint's
// extension of no-dupe-class-members ignores the signatures. Two real bodies
// under one name remain a duplicate.
//
//  1. Run the rule over a class whose method has two overload signatures and an
//     implementation, and over a static overload set.
//  2. Assert both report nothing.
//  3. Run the rule over a class with two implemented methods of one name and
//     assert exactly the second one reports.
//
// @evidence contracts/testing.md#behavioral-verification no-dupe-class-members must accept overload signatures that precede one implementation while still reporting a second implemented method of the same name.
// @evidence contracts/testing.md#independent-expectations The expectations follow the TypeScript overload grammar: bodiless signatures belong to the implementation that follows, and two bodies under one name are a real redefinition.
// @evidence contracts/testing.md#distinguishing-cases Instance and static overload sets stay clean, while the implemented duplicate is reported on its own range, so acceptance cannot come from the rule ignoring methods altogether.
// @evidence contracts/testing.md#execution-ownership TestNoDupeClassMembersAllowsTypeScriptOverloadSignatures parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoDupeClassMembersAllowsTypeScriptOverloadSignatures(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-dupe-class-members",
    "class Overloaded {\n  run(a: string): void;\n  run(a: number): void;\n  run(a: string | number): void {\n    void a;\n  }\n}\nJSON.stringify(Overloaded);\n",
  )
  assertRuleSkipsSource(
    t,
    "no-dupe-class-members",
    "class StaticOverloaded {\n  static make(a: string): void;\n  static make(a: number): void;\n  static make(a: string | number): void {\n    void a;\n  }\n}\nJSON.stringify(StaticOverloaded);\n",
  )
  assertRuleFindingRanges(
    t,
    "no-dupe-class-members",
    "class Twice {\n  run(): void { void 0; }\n  run(): void {}\n}\nJSON.stringify(Twice);\n",
    "run(): void {}",
  )
}
