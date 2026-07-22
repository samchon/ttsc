package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFormatLaysOutAControlFlowBody verifies a loop or `if` inside a
// reflowed block is laid out rather than frozen at its source width.
//
// `dispatchNode` handled two statement kinds. Everything else — the three `for`
// forms, `while`, `if`, `try`, `switch`, `throw`, and a variable statement —
// fell through to `verbatim`, so `printBlock` expanded a body while a statement
// inside it stayed on one line. That half-expanded shape is one of the three
// causes #922's first attempt was reverted for, and it is what #928 exists to
// close.
//
// Every expectation was measured on the pinned Prettier 3.8.3 with the exact
// input beside it.
func TestCommandFormatLaysOutAControlFlowBody(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
    want   string
  }{
    {
      "for-of",
      "run(() => {\n  for (const x of xs) { f(x); }\n});\n",
      "run(() => {\n  for (const x of xs) {\n    f(x);\n  }\n});\n",
    },
    {
      "while",
      "run(() => {\n  while (n) { n--; }\n});\n",
      "run(() => {\n  while (n) {\n    n--;\n  }\n});\n",
    },
    {
      "for",
      "run(() => {\n  for (let i = 0; i < n; i++) { f(i); }\n});\n",
      "run(() => {\n  for (let i = 0; i < n; i++) {\n    f(i);\n  }\n});\n",
    },
    {
      "if without else",
      "run(() => {\n  if (n) { f(n); }\n});\n",
      "run(() => {\n  if (n) {\n    f(n);\n  }\n});\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")

      got := formatOnceForBrace(t, root, main)
      if got != tc.want {
        t.Fatalf("control-flow body not laid out:\ngot  %q\nwant %q", got, tc.want)
      }
      if again := formatOnceForBrace(t, root, main); again != tc.want {
        t.Fatalf("second pass moved the output:\ngot  %q\nwant %q", again, tc.want)
      }
    })
  }
}

// TestCommandFormatLeavesABracelessBodyAlone is the negative twin.
//
// Prettier keeps a braceless body on its header's terms, and `format/indent`
// cedes such a body entirely (`cededUnderBracelessBody`) because the
// block-depth model has no frame for the extra level Prettier gives it.
// Dispatching one here would reintroduce the disagreement that guard exists to
// prevent, so the printer takes only a Block.
//
// The `else` and `try` shapes are held back for the same reason a printer
// should not be half-written: laying them out means minting the keyword between
// two bodies, which is a different printer than "prefix plus one body". They
// stay verbatim and stay correct.
func TestCommandFormatLeavesABracelessBodyAlone(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
  }{
    {"braceless for-of", "run(() => {\n  for (const x of xs) f(x);\n});\n"},
    {"braceless if", "run(() => {\n  if (n) f(n);\n});\n"},
    {
      "if with else stays whole",
      "run(() => {\n  if (n) {\n    f(n);\n  } else {\n    g(n);\n  }\n});\n",
    },
    {
      "try stays whole",
      "run(() => {\n  try {\n    f();\n  } catch (e) {\n    g();\n  }\n});\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")
      if got := formatOnceForBrace(t, root, main); got != tc.source {
        t.Fatalf("source must survive unchanged:\ngot  %q\nwant %q", got, tc.source)
      }
    })
  }
}
