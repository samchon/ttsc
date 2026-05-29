package linthost

import "testing"

// TestRuleCorpusPreferArrowCallback verifies the lint rule corpus
// fixture prefer-arrow-callback.ts.
//
// The rule fires on `function () {}` expressions passed as callback
// arguments to a call or `new` expression; the suggested replacement
// is an arrow function. The fixture covers two positive callers plus
// the conservative skips (generators, `this`, `arguments`).
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusPreferArrowCallback(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-arrow-callback.ts", "declare const list: readonly number[];\n\n// Positive: a plain function expression used as the `.map` callback.\nlist.map(\n  // expect: prefer-arrow-callback error\n  function (n: number) {\n    return n * 2;\n  },\n);\n\n// Positive: a function expression passed to setTimeout. The arrow form\n// is the obvious replacement.\nsetTimeout(\n  // expect: prefer-arrow-callback error\n  function () {\n    JSON.stringify(\"done\");\n  },\n  10,\n);\n\n// Negative: an arrow function — already the recommended form.\nlist.map((n) => n + 1);\n\n// Negative: a generator function expression cannot be expressed as an\n// arrow at all.\nconst gen = function* () {\n  yield 1;\n};\nJSON.stringify([...gen()]);\n\n// Negative: the body reads `this`, so converting to an arrow would\n// capture the surrounding `this` and change behaviour.\nfunction runner(this: { value: number }) {\n  list.map(\n    function (this: { value: number }, n: number) {\n      return n + this.value;\n    },\n    this,\n  );\n}\nrunner.call({ value: 1 });\n\n// Negative: the body reads `arguments`. Arrows have no `arguments`\n// binding, so the conversion would break.\nfunction variadic() {\n  return [].map.call(\n    arguments,\n    function () {\n      // eslint-disable-next-line prefer-rest-params\n      return arguments.length;\n    },\n  );\n}\nJSON.stringify(variadic(1, 2, 3));\n")
}
