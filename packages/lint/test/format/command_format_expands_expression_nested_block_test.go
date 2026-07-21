package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFormatExpandsExpressionNestedOneLineBlock verifies a non-empty
// block in expression position is expanded, as Prettier's block printer does
// unconditionally.
//
// This is the half of #856 the brace-ownership split did not take. That split
// made `format/indent` and `format/statement-split` both cede an
// expression-nested block, which was right for those two — splitting a body
// whose brace neither can restore is what produced the stranded hybrid — and it
// left the block whole, which Prettier never does. The third rule owns it:
// Prettier emits a hardline after `{` for ANY non-empty block, so the break is
// a property of the block rather than of the width, and `format/print-width`
// now denies its fast path for one. `printBlock` already emitted that hardline;
// the fast path was returning before it could run.
//
// Expected output is the pinned Prettier 3.8.3's, trailing comma included.
func TestCommandFormatExpandsExpressionNestedOneLineBlock(t *testing.T) {
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
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")

      got := formatOnceForBrace(t, root, main)
      if got != tc.want {
        t.Fatalf("expression-nested block not expanded:\ngot  %q\nwant %q", got, tc.want)
      }
      // The whole defect class here is a STABLE wrong output, so stability
      // proves nothing unless the shape it is stable on is the right one.
      if again := formatOnceForBrace(t, root, main); again != tc.want {
        t.Fatalf("second pass moved the output:\ngot  %q\nwant %q", again, tc.want)
      }
    })
  }
}

// TestCommandFormatKeepsEmptyExpressionNestedBlock verifies the empty twin is
// untouched.
//
// Prettier keeps `{}` on one line wherever it appears, so the force-break has
// to read the block's contents rather than its position. A predicate that fired
// on "a block in expression position" would expand every one of these.
func TestCommandFormatKeepsEmptyExpressionNestedBlock(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
  }{
    {"empty-callback", "run(() => {});\n"},
    {"empty-object-method", "export const o = { m() {} };\n"},
    {"empty-function-expression", "run(function () {});\n"},
    {"empty-array-element-callback", "export const fns = [() => {}];\n"},
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")
      if got := formatOnceForBrace(t, root, main); got != tc.source {
        t.Fatalf("an empty block must stay on one line:\ngot  %q\nwant %q", got, tc.source)
      }
    })
  }
}
