package linthost

import "testing"

// TestUnicornThrowNewErrorFixParenthesizesAShieldedCallChain verifies the callee
// parenthesization decision on the TypeScript-only chain shapes upstream's
// ESTree fixer never sees.
//
// `new`'s callee grammar ends at the first argument list, so the fix has to
// parenthesize a callee whose object chain still exposes a call. A non-null
// assertion does not shield that call — upstream's walk stops at
// `TSNonNullExpression` and would emit `new lib.getError()!.FooError()`, which
// constructs `lib.getError()` and reads `.FooError()` off the instance — while
// real parentheses do shield it, so `(lib.getError() as any).FooError()` must
// not collect a second pair. Type arguments belong to the call, not the callee,
// so the closing parenthesis has to land before them.
//
//  1. Fix a `!`-pierced chain, two parenthesis-shielded chains, and a generic
//     call with and without a parenthesized callee.
//  2. Compare the rewritten file byte-for-byte.
//  3. Reparse the output and assert the rule no longer fires on it.
//
// @evidence contracts/testing.md#behavioral-verification Exact fix snapshots, parse validity and accepted fixed output distinguish constructing the wrong call-chain receiver from constructing the intended Error callee.
// @evidence contracts/testing.md#independent-expectations JavaScript new-expression callee grammar and TypeScript non-null/type-argument grammar establish the independently authored parenthesis placements.
// @evidence contracts/testing.md#distinguishing-cases Non-null assertion does not shield a call; actual parentheses do. Generic arguments stay attached to the call outside any inserted callee parentheses.
// @evidence contracts/testing.md#execution-ownership TestUnicornThrowNewErrorFixParenthesizesAShieldedCallChain is the named Go unit owner of these authored sources and any named t.Run variants. Engine, parser and fix applier operate in the shared Go process with temporary fixture files; no installation, native build or real product child runs.
func TestUnicornThrowNewErrorFixParenthesizesAShieldedCallChain(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "non-null assertion does not shield the call",
      source:   "throw lib.getError()!.FooError();\n",
      expected: "throw new (lib.getError()!.FooError)();\n",
    },
    {
      name:     "parentheses shield the call",
      source:   "throw (lib.getError() as any).FooError();\n",
      expected: "throw new (lib.getError() as any).FooError();\n",
    },
    {
      name:     "parenthesized call object shields the call",
      source:   "throw (getGlobalThis()).Error();\n",
      expected: "throw new (getGlobalThis()).Error();\n",
    },
    {
      name:     "type arguments stay with the call",
      source:   "throw ns.FooError<string>(\"x\");\n",
      expected: "throw new ns.FooError<string>(\"x\");\n",
    },
    {
      name:     "type arguments stay outside a parenthesized callee",
      source:   "throw getNs().FooError<string>(\"x\");\n",
      expected: "throw new (getNs().FooError)<string>(\"x\");\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshot(t, "unicorn/throw-new-error", test.source, test.expected)
      file := parseTSFile(t, "/virtual/shielded-throw-new-error.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSource(t, "unicorn/throw-new-error", test.expected)
    })
  }
}
