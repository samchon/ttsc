package linthost

import "testing"

// TestRuleCorpusUnicornThrowNewError verifies unicorn/throw-new-error reports a
// call-form throw for a built-in, a user-defined, and a namespaced error class.
//
// The rule fires when the throw operand is a CallExpression whose callee names
// an error constructor — an identifier or a non-computed property whose name
// matches upstream's `^(?:[A-Z][\da-z]*)*Error$` pattern. This fixture mirrors
// the TypeScript corpus case: the three matched callee shapes, plus the
// unannotated forms that must stay silent (an already-constructed `new`, a
// computed key, an optional chain, and a non-error name).
//
// 1. Enable unicorn/throw-new-error via expect annotations.
// 2. Throw `Error(...)`, `ValidationError(...)`, and `ns.CustomError(...)`.
// 3. Assert exactly those three call expressions are reported.
func TestRuleCorpusUnicornThrowNewError(t *testing.T) {
  assertRuleCorpusCase(
    t,
    "unicorn/throw-new-error.ts",
    "declare const ValidationError: any;\ndeclare const ns: any;\ndeclare const getError: any;\n\n"+
      "function builtinCallee() {\n  // expect: unicorn/throw-new-error error\n  throw Error(\"oops\");\n}\n\n"+
      "function customErrorCallee() {\n  // expect: unicorn/throw-new-error error\n  throw ValidationError(\"bad\");\n}\n\n"+
      "function memberCallee() {\n  // expect: unicorn/throw-new-error error\n  throw ns.CustomError(\"bad\");\n}\n\n"+
      "function alreadyConstructed() {\n  throw new ValidationError(\"bad\");\n}\n\n"+
      "function computedCallee() {\n  throw ns[\"CustomError\"](\"bad\");\n}\n\n"+
      "function optionalCallee() {\n  throw ns?.CustomError(\"bad\");\n}\n\n"+
      "function nonErrorCallee() {\n  throw getError();\n}\n",
  )
}
