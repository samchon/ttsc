package linthost

import "testing"

// TestUnicornThrowNewErrorFixesUpstreamInvalidCorpus verifies fourteen selected
// throw-shaped cases from the upstream snapshot rewrite to its fix output
// through the native fix applier.
//
// The expected outputs are transcribed from eslint-plugin-unicorn 71.1.0's
// test/snapshots/throw-new-error.js.md, so the port cannot lock in its own
// bugs. The subtle half is the callee grammar: a `new` expression's callee ends
// at the first argument list, so `throw getGlobalThis().Error()` may not become
// `throw new getGlobalThis().Error()` — that constructs `getGlobalThis()` and
// reads `.Error()` off the result. Upstream parenthesizes the callee whenever a
// call sits on its object chain and the source has not parenthesized it already;
// both branches are pinned here, along with the parenthesized-callee and
// parenthesized-operand shapes whose insert offsets differ.
//
//  1. Run the fixer over each of the fourteen selected upstream invalid sources.
//  2. Compare the rewritten file byte-for-byte with the upstream output.
//  3. Reparse the output and assert the rule no longer fires on it.
//
// @evidence contracts/testing.md#behavioral-verification Exact fix snapshots, reparsing and clean output distinguish incorrectly inserted constructor syntax across the fourteen explicitly named upstream sources; this entry does not select every throw-shaped source in the upstream snapshot.
// @evidence contracts/testing.md#independent-expectations The transcribed eslint-plugin-unicorn 71.1.0 throw-new-error snapshots establish literal expected outputs independently of this Go implementation.
// @evidence contracts/testing.md#distinguishing-cases Fourteen named forms cover built-ins/custom names/acronyms/digits, member/computed links, parenthesized callees/operands and call chains; authored fixed counterparts remain clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornThrowNewErrorFixesUpstreamInvalidCorpus is the named Go unit owner of these authored sources and any named t.Run variants. Engine, parser and fix applier operate in the shared Go process with temporary fixture files; no installation, native build or real product child runs.
func TestUnicornThrowNewErrorFixesUpstreamInvalidCorpus(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "builtin identifier callee",
      source:   "throw Error();\n",
      expected: "throw new Error();\n",
    },
    {
      name:     "custom error identifier callee",
      source:   "throw CustomError('foo');\n",
      expected: "throw new CustomError('foo');\n",
    },
    {
      name:     "acronym word callee",
      source:   "throw ABCError('foo');\n",
      expected: "throw new ABCError('foo');\n",
    },
    {
      name:     "digit inside a word callee",
      source:   "throw Abc3Error('foo');\n",
      expected: "throw new Abc3Error('foo');\n",
    },
    {
      name:     "parenthesized callee",
      source:   "throw (Error)();\n",
      expected: "throw new (Error)();\n",
    },
    {
      name:     "member callee",
      source:   "throw lib.Error();\n",
      expected: "throw new lib.Error();\n",
    },
    {
      name:     "nested member callee",
      source:   "throw lib.mod.Error();\n",
      expected: "throw new lib.mod.Error();\n",
    },
    {
      name:     "computed link inside the callee chain",
      source:   "throw lib[mod].Error();\n",
      expected: "throw new lib[mod].Error();\n",
    },
    {
      name:     "parenthesized object inside the callee chain",
      source:   "throw (lib.mod).Error();\n",
      expected: "throw new (lib.mod).Error();\n",
    },
    {
      name:     "parenthesized operand",
      source:   "throw (( URIError() ));\n",
      expected: "throw (( new URIError() ));\n",
    },
    {
      name:     "parenthesized identifier callee",
      source:   "throw (( URIError ))();\n",
      expected: "throw new (( URIError ))();\n",
    },
    {
      name:     "call on the callee chain needs parentheses",
      source:   "throw getGlobalThis().Error();\n",
      expected: "throw new (getGlobalThis().Error)();\n",
    },
    {
      name:     "deep call on the callee chain needs parentheses",
      source:   "throw utils.getGlobalThis().Error();\n",
      expected: "throw new (utils.getGlobalThis().Error)();\n",
    },
    {
      name:     "already parenthesized callee keeps its parentheses",
      source:   "throw (( getGlobalThis().Error ))();\n",
      expected: "throw new (( getGlobalThis().Error ))();\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshot(t, "unicorn/throw-new-error", test.source, test.expected)
      file := parseTSFile(t, "/virtual/fixed-throw-new-error.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSource(t, "unicorn/throw-new-error", test.expected)
    })
  }
}
