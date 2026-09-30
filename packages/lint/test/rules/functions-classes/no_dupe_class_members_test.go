package linthost

import "testing"

// TestRuleCorpusNoDupeClassMembers verifies the lint rule corpus
// fixture no-dupe-class-members.ts.
//
// The rule collects class member declarations by (name, static, kind)
// triple and reports the second declaration of any colliding key. A
// getter+setter pair on the same key coexists because they have
// different kinds; an instance vs static member with the same name
// also coexists.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the second duplicate run method while permitting getter/setter and static/instance distinctions.
// @evidence contracts/testing.md#independent-expectations Member identity includes accessor kind and staticness; independently authored distinct member roles supply negative twins.
// @evidence contracts/testing.md#distinguishing-cases Two run methods report; matching getter/setter pair and same-name static versus instance methods stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDupeClassMembers is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-dupe-class-members.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoDupeClassMembers(t *testing.T) {
  assertRuleCorpusCase(t, "no-dupe-class-members.ts", "class Foo {\n  run(): number {\n    return 1;\n  }\n  // expect: no-dupe-class-members error\n  run(): number {\n    return 2;\n  }\n}\nJSON.stringify(Foo);\n")
  assertRuleSkipsSource(t, "no-dupe-class-members", "class Foo { get value() { return 1; } set value(input: number) {} static run() {} run() {} }\n")
}
