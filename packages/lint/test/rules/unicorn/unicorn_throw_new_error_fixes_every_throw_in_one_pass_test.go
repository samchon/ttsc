package linthost

import "testing"

// TestUnicornThrowNewErrorFixesEveryThrowInOnePass verifies a file carrying
// several violations is rewritten completely by a single fix pass.
//
// One finding of this rule can carry three text edits (a separating space, the
// `new ` insert, a closing parenthesis), so a file with several violations hands
// the applier a mixed batch of zero-width inserts. `selectTextEdits` drops any
// edit that overlaps an earlier one and any second zero-width insert at an
// offset already claimed, so a fixer that mis-anchored one of its edits would
// silently lose edits from a neighboring finding and leave the file broken
// (a bare `new` with no callee parentheses, say). Fixing every shape at once is
// what proves the offsets are disjoint.
//
//  1. Lint one file holding an identifier callee, a member callee, a callee that
//     needs parentheses, and an operand that abuts the `throw` keyword.
//  2. Apply the fixes in a single pass and compare the whole file.
//  3. Reparse the output and assert the rule no longer fires on it.
func TestUnicornThrowNewErrorFixesEveryThrowInOnePass(t *testing.T) {
  source := "function a() {\n  throw ValidationError(\"bad\");\n}\n" +
    "function b() {\n  throw ns.FooError(\"x\");\n}\n" +
    "function c() {\n  throw getGlobalThis().Error();\n}\n" +
    "function d() {\n  throw[globalThis][0].Error();\n}\n"
  expected := "function a() {\n  throw new ValidationError(\"bad\");\n}\n" +
    "function b() {\n  throw new ns.FooError(\"x\");\n}\n" +
    "function c() {\n  throw new (getGlobalThis().Error)();\n}\n" +
    "function d() {\n  throw new [globalThis][0].Error();\n}\n"

  assertFixSnapshot(t, "unicorn/throw-new-error", source, expected)
  file := parseTSFile(t, "/virtual/batch-throw-new-error.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  assertRuleSkipsSource(t, "unicorn/throw-new-error", expected)
}
