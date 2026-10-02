package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFormatLaysOutAStatementBody verifies nine authored statement
// layouts inside a reflowed callback body.
//
// Control-flow bodies, variable initializers and thrown expressions must use
// structured child layouts while preserving their headers and surrounding
// syntax. Complete authored literals specify the intended first result;
// a second invocation must preserve that same result.
//
//  1. Put each statement kind on one line inside a reflowed callback body.
//  2. Run format and compare with the authored complete expected source.
//  3. Run a second pass and require idempotence.
//
// @evidence contracts/testing.md#behavioral-verification Nine subcases (for-of, for-in, while, for, if-else, try-catch-finally, switch, variable with callback, throw) run the in-process `format` command on a callback whose body statement is on one line and require the exact expanded text, then a second run that must leave it unchanged.
// @evidence contracts/testing.md#independent-expectations The nine complete authored literals preserve loop headers, conditions, bindings, calls, clause structure and throw syntax while expanding nested blocks. First-result equality does not derive expectations from the formatter; the second call separately checks stability. No independent Prettier process runs in this unit.
// @evidence contracts/testing.md#distinguishing-cases Each statement kind is its own input that must change from half-frozen one-line form to fully laid-out form. All cases sit inside a callback body, so top-level placement and statements beyond the nine listed are not covered.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase seeds a temp-dir project and calls run with the format subcommand through formatOnceForBrace; no child process, built binary or installed consumer.
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
