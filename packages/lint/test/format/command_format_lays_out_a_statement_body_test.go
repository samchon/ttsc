package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFormatLaysOutAStatementBody verifies every statement kind named
// by #928 is laid out inside a reflowed block rather than frozen at its source
// width.
//
// `dispatchNode` handled expression and return statements only. The three
// `for` forms, `while`, `if`, `try`, `switch`, `throw`, and a variable
// statement fell through to `verbatim`, so `printBlock` expanded a body while
// one of those statements stayed on one line. That half-expanded shape is one
// of the three causes #922's first attempt was reverted for.
//
// Every expectation was measured on the pinned Prettier 3.8.3 with the exact
// input beside it.
//
//  1. Put each statement kind on one line inside a reflowed callback body.
//  2. Run `ttsc format` and compare with the Prettier answer key.
//  3. Run a second pass and require idempotence.
func TestCommandFormatLaysOutAStatementBody(t *testing.T) {
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
      "for-in",
      "run(() => {\n  for (const key in record) { visit(key); }\n});\n",
      "run(() => {\n  for (const key in record) {\n    visit(key);\n  }\n});\n",
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
      "if-else",
      "run(() => {\n  if (n) { f(n); } else { g(n); }\n});\n",
      "run(() => {\n  if (n) {\n    f(n);\n  } else {\n    g(n);\n  }\n});\n",
    },
    {
      "try-catch-finally",
      "run(() => {\n  try { f(); } catch (error) { g(error); } finally { h(); }\n});\n",
      "run(() => {\n  try {\n    f();\n  } catch (error) {\n    g(error);\n  } finally {\n    h();\n  }\n});\n",
    },
    {
      "switch",
      "run(() => {\n  switch (n) { case 1: f(); break; default: g(); }\n});\n",
      "run(() => {\n  switch (n) {\n    case 1:\n      f();\n      break;\n    default:\n      g();\n  }\n});\n",
    },
    {
      "variable",
      "run(() => {\n  const task = () => { f(); };\n});\n",
      "run(() => {\n  const task = () => {\n    f();\n  };\n});\n",
    },
    {
      "throw",
      "run(() => {\n  throw makeError(() => { f(); });\n});\n",
      "run(() => {\n  throw makeError(() => {\n    f();\n  });\n});\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")

      got := formatOnceForBrace(t, root, main)
      if got != tc.want {
        t.Fatalf("statement body not laid out:\ngot  %q\nwant %q", got, tc.want)
      }
      if again := formatOnceForBrace(t, root, main); again != tc.want {
        t.Fatalf("second pass moved the output:\ngot  %q\nwant %q", again, tc.want)
      }
    })
  }
}
