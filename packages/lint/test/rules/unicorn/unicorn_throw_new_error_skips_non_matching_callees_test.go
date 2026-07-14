package linthost

import "testing"

// TestUnicornThrowNewErrorSkipsNonMatchingCallees verifies the negative twin of
// every branch the widened callee predicate opened.
//
// Matching any `*Error` name instead of eight built-ins is only safe with the
// counter-examples pinned: the name pattern is anchored and case-sensitive
// (`fooError`, `ERROR`, `Errors` must stay silent), computed member access is
// opaque (`lib["Error"]()`), and an optional chain must never be reported
// because the autofix would emit `new lib?.Error()`, which is a syntax error —
// the fix, not just the report, is what makes these exclusions load-bearing.
// `Data.TaggedError()` is upstream's Effect-library carve-out; it builds an
// error class, so `new` would be wrong.
//
//  1. Lint each source with only unicorn/throw-new-error enabled.
//  2. Assert the engine emits no finding at all.
func TestUnicornThrowNewErrorSkipsNonMatchingCallees(t *testing.T) {
  for _, source := range []string{
    // Already constructed with `new`.
    "throw new Error(\"oops\");\n",
    "throw new ValidationError(\"bad\");\n",
    "throw new ns.FooError();\n",
    "throw new (getGlobalThis().Error)();\n",
    // Not an `*Error` name.
    "throw getError();\n",
    "throw lib.getError();\n",
    "throw ns.notAnError();\n",
    "throw Error2();\n",
    // The name pattern is anchored, case-sensitive, and word-shaped.
    "throw fooError();\n",
    "throw ERROR();\n",
    "throw Errors();\n",
    "throw My_Error();\n",
    "throw $Error();\n",
    "throw _Error();\n",
    // Not a call expression.
    "throw ValidationError;\n",
    "throw FooError`x`;\n",
    // The callee is neither an Identifier nor a member access.
    "throw getErrorConstructor()();\n",
    // Computed member access.
    "throw lib[\"Error\"]();\n",
    "throw lib[Error]();\n",
    // Optional chains: `new` cannot be applied to one.
    "throw Error?.();\n",
    "throw lib.Error?.();\n",
    "throw lib?.Error();\n",
    "throw lib?.foo.Error();\n",
    "throw lib?.[key].Error();\n",
    "throw lib?.foo!.Error();\n",
    "throw getGlobalThis?.().Error();\n",
    "throw (lib?.Error)();\n",
    // Upstream's Effect-library carve-out.
    "throw Data.TaggedError(\"x\");\n",
  } {
    t.Run(source, func(t *testing.T) {
      assertRuleSkipsSource(t, "unicorn/throw-new-error", source)
    })
  }
}
