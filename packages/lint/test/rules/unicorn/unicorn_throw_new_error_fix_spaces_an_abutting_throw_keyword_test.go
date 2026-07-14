package linthost

import "testing"

// TestUnicornThrowNewErrorFixSpacesAnAbuttingThrowKeyword verifies the fix keeps
// the `throw` keyword a separate token when the operand starts right against it.
//
// A bare `insertTextBefore(call, "new ")` corrupts any source whose operand
// needs no space after `throw` — `throw[lib][0].Error()` would become
// `thrownew [lib][0].Error()`, a different program that no longer parses.
// Upstream solves it with `fixSpaceAroundKeyword`; the port emits the space at
// the operand's own start, which is outside any parentheses wrapping it, and
// folds it into the `new ` insert when both land on the same offset — two
// zero-width inserts at one offset cannot both survive edit selection.
//
//  1. Fix an operand that abuts `throw` directly, one that abuts it and also
//     needs a parenthesized callee (both inserts land on one offset, so they
//     have to merge into a single edit), one behind parentheses, and one behind
//     a comment (trivia is not adjacency).
//  2. Compare the rewritten file byte-for-byte.
//  3. Reparse the output and assert the rule no longer fires on it.
func TestUnicornThrowNewErrorFixSpacesAnAbuttingThrowKeyword(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "operand abuts the keyword",
      source:   "throw[globalThis][0].Error();\n",
      expected: "throw new [globalThis][0].Error();\n",
    },
    {
      name:     "abutting operand whose callee also needs parentheses",
      source:   "throw[globalThis][0].getError().FooError();\n",
      expected: "throw new ([globalThis][0].getError().FooError)();\n",
    },
    {
      name:     "parentheses abut the keyword",
      source:   "throw(Error());\n",
      expected: "throw (new Error());\n",
    },
    {
      name:     "comment separates the keyword",
      source:   "throw/* c */Error();\n",
      expected: "throw/* c */new Error();\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshot(t, "unicorn/throw-new-error", test.source, test.expected)
      file := parseTSFile(t, "/virtual/spaced-throw-new-error.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSource(t, "unicorn/throw-new-error", test.expected)
    })
  }
}
