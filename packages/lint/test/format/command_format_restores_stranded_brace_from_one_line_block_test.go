package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresStrandedBraceFromOneLineBlock verifies the `ttsc
// format` cascade converges on the form Prettier produces for a block written
// on one line, instead of on a hybrid that strands the closing `}` at the end
// of the last statement.
//
// The cascade used to split the body onto its own lines while nothing moved
// the brace: `format/statement-split` only ever rewrites the run before a
// STATEMENT, and a `}` is not one, while `format/indent` abstained on any
// brace sharing its line with content. The result was stable under a second
// pass, so the malformed shape was the tool's canonical form and `ttsc check`
// called it clean.
//
// Each case is a block form from the report — function body, `if`/`else`,
// loops, `try`/`catch`/`finally`, class body, arrow body, switch clause — with
// the pinned Prettier 3.8.3 output as the answer key.
//
//  1. Run `ttsc format` on the one-line source.
//  2. Assert convergence and byte equality with the expected output.
//  3. Run it again and assert the output does not move (idempotence).
func TestCommandFormatRestoresStrandedBraceFromOneLineBlock(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
    want   string
  }{
    {
      "function-body",
      "export function f1(n: number) { return n; }\n",
      "export function f1(n: number) {\n  return n;\n}\n",
    },
    {
      "if-else",
      "export function go(n: number) {\n  if (n > 0) { return 1; } else { return 2; }\n}\n",
      "export function go(n: number) {\n" +
        "  if (n > 0) {\n" +
        "    return 1;\n" +
        "  } else {\n" +
        "    return 2;\n" +
        "  }\n" +
        "}\n",
    },
    {
      "for-loop",
      "export function f3(n: number) { for (let i = 0; i < n; i++) { log(i); } }\n",
      "export function f3(n: number) {\n" +
        "  for (let i = 0; i < n; i++) {\n" +
        "    log(i);\n" +
        "  }\n" +
        "}\n",
    },
    {
      "while-loop",
      "export function f4(n: number) { while (n) { n--; } }\n",
      "export function f4(n: number) {\n" +
        "  while (n) {\n" +
        "    n--;\n" +
        "  }\n" +
        "}\n",
    },
    {
      "try-catch-finally",
      "export function f5() { try { g(); } catch (e) { h(); } finally { g(); } }\n",
      "export function f5() {\n" +
        "  try {\n" +
        "    g();\n" +
        "  } catch (e) {\n" +
        "    h();\n" +
        "  } finally {\n" +
        "    g();\n" +
        "  }\n" +
        "}\n",
    },
    {
      "class-and-method-body",
      "export class C { m() { return 1; } }\n",
      "export class C {\n  m() {\n    return 1;\n  }\n}\n",
    },
    {
      "arrow-body",
      "export const a = () => { return 1; };\n",
      "export const a = () => {\n  return 1;\n};\n",
    },
    {
      "switch-case-block",
      "export function f6(n: number) { switch (n) { case 1: { break; } } }\n",
      "export function f6(n: number) {\n" +
        "  switch (n) {\n" +
        "    case 1: {\n" +
        "      break;\n" +
        "    }\n" +
        "  }\n" +
        "}\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")

      got := formatOnceForBrace(t, root, main)
      if got != tc.want {
        t.Fatalf("stranded brace not restored:\ngot  %q\nwant %q", got, tc.want)
      }
      // A second pass must not move the converged output: the whole defect
      // was a STABLE malformed form, so stability alone proves nothing unless
      // the form it is stable on is the right one.
      if again := formatOnceForBrace(t, root, main); again != tc.want {
        t.Fatalf("second pass moved the output:\ngot  %q\nwant %q", again, tc.want)
      }
    })
  }
}

// formatOnceForBrace runs `ttsc format` over the seeded project and returns the
// resulting file text, failing the test when the cascade does not converge.
func formatOnceForBrace(t *testing.T, root string, main string) string {
  t.Helper()
  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 0 || strings.Contains(stderr, "did not converge") {
    t.Fatalf("format did not converge: code=%d stderr=%q", code, stderr)
  }
  got, err := os.ReadFile(main)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  return string(got)
}
