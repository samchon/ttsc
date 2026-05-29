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
func TestRuleCorpusNoDupeClassMembers(t *testing.T) {
  assertRuleCorpusCase(t, "no-dupe-class-members.ts", "class Foo {\n  run(): number {\n    return 1;\n  }\n  // expect: no-dupe-class-members error\n  run(): number {\n    return 2;\n  }\n}\nJSON.stringify(Foo);\n")
}
