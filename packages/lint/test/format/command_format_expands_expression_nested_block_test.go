package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFormatExpandsExpressionNestedBlock verifies every non-empty block
// named by #922 expands in expression position exactly as Prettier does.
//
// Object members, statement bodies, and call-bodied arrows are all structured
// printer paths now. That lets the print-width rule deny its flat fast path for
// a non-empty block without leaving a nested body frozen or breaking the call
// at the wrong boundary. A comment-only block counts as non-empty too.
//
//  1. Put non-empty blocks in object, call, array, conditional, and nested-arrow
//     expression positions.
//  2. Run `ttsc format` and compare with the Prettier 3.8.3 answer key.
//  3. Run a second pass and require idempotence.
func TestCommandFormatExpandsExpressionNestedBlock(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
    want   string
  }{
    {
      "object-literal-method",
      "export const o = { m() { return 1; } };\n",
      "export const o = {\n  m() {\n    return 1;\n  },\n};\n",
    },
    {
      "callback-body",
      "run(() => { a(); b(); });\n",
      "run(() => {\n  a();\n  b();\n});\n",
    },
    {
      "function-expression-argument",
      "run(function () { a(); });\n",
      "run(function () {\n  a();\n});\n",
    },
    {
      "array-element-callback",
      "export const fns = [() => { a(); }];\n",
      "export const fns = [\n  () => {\n    a();\n  },\n];\n",
    },
    {
      "conditional-arm-callback",
      "export const fn = ready ? () => { a(); } : () => { b(); };\n",
      "export const fn = ready\n  ? () => {\n      a();\n    }\n  : () => {\n      b();\n    };\n",
    },
    {
      "call-bodied-arrow",
      "run(() => foo(() => { a(); }));\n",
      "run(() =>\n  foo(() => {\n    a();\n  }),\n);\n",
    },
    {
      "comment-only-block",
      "run(() => { /* c */ });\n",
      "run(() => {\n  /* c */\n});\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")

      got := formatOnceForBrace(t, root, main)
      if got != tc.want {
        t.Fatalf("expression-nested block not expanded:\ngot  %q\nwant %q", got, tc.want)
      }
      if again := formatOnceForBrace(t, root, main); again != tc.want {
        t.Fatalf("second pass moved the output:\ngot  %q\nwant %q", again, tc.want)
      }
    })
  }
}
