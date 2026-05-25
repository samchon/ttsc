package linthost

import "testing"

// TestFixNoExtraBooleanCastDropsRedundantCoercionAndKeepsMeaningfulOnes
// verifies that the noExtraBooleanCast rule emits an autofix removing
// `!!x` and `Boolean(x)` inside boolean contexts, while keeping any `!!x`
// whose value is consumed as a non-boolean (the semantically meaningful
// double negation that callers use to coerce to a real `boolean`).
//
// Without the autofix the `fix` cascade could not converge on fixtures that
// use `if (!!x)` or `if (Boolean(x))` in hot paths. The detection branch
// already filters by `isInBooleanContext`, so a free-standing `const b =
// !!x;` is intentionally untouched — that is the canonical idiom for
// boolean coercion and must remain unflagged.
//
//  1. Snapshot the `if (!!x)` → `if (x)` rewrite — the double-bang branch.
//  2. Snapshot the `if (Boolean(x))` → `if (x)` rewrite — the Boolean-call
//     branch, exercising the single-argument check.
//  3. Assert `const b = !!x;` emits zero findings so the meaningful `!!`
//     branch is locked.
func TestFixNoExtraBooleanCastDropsRedundantCoercionAndKeepsMeaningfulOnes(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (!!x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (Boolean(x)) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
  assertRuleSkipsSource(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  const b = !!x;\n  return b;\n}\nJSON.stringify(f);\n",
  )
}
