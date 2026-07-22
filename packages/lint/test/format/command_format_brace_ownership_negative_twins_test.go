package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatBraceOwnershipNegativeTwins pins what taking ownership of a
// shared-line brace must NOT reach.
//
// The stranded-brace fix gives `format/indent` a brace and a member header
// that no rule claimed before, so its risk is over-reach: every one of these
// shapes is either already what Prettier 3.8.3 emits, or a frame the format
// rules deliberately hand to `format/print-width`. Each must survive `ttsc
// format` byte-for-byte.
//
//  1. Seed the source.
//  2. Run `ttsc format`.
//  3. Assert the file is unchanged.
func TestCommandFormatBraceOwnershipNegativeTwins(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
  }{
    // Prettier keeps an empty body on one line; there is no statement to
    // break out, so there is nothing for the brace to be consistent with.
    {"empty-block", "export function f() {}\n"},
    {"empty-interface", "export interface Gamma {}\n"},
    {"empty-class", "export class Empty {}\n"},
    {"empty-method-body", "export class C {\n  m() {}\n}\n"},
    // An object TYPE keeps the author's shape when the source wrote no break
    // after `{`, so its members must not be broken out the way a class or
    // interface body's are.
    {"inline-type-literal", "export type T = { a: number };\n"},
    // `} else {`, `} catch (e) {`, `} finally {` are the canonical Prettier
    // spellings: the `}` is already the first byte on its line, so the
    // shared-line rule must read the brace's own line, not the line's tail.
    {
      "canonical-else-catch-finally",
      "export function f(n: number) {\n" +
        "  if (n) {\n" +
        "    a();\n" +
        "  } else {\n" +
        "    b();\n" +
        "  }\n" +
        "  try {\n" +
        "    c();\n" +
        "  } catch (e) {\n" +
        "    d();\n" +
        "  } finally {\n" +
        "    e();\n" +
        "  }\n" +
        "}\n",
    },
    // A block whose brace-line gap carries a comment. Both new claims walk
    // back over spaces and tabs only, so a comment bounds the run and cannot
    // be swallowed; this asserts that rather than leaving it incidental.
    {
      "comment-before-claimed-brace",
      "export function f() {\n  a(); /* trailing */\n}\n",
    },
    {
      "line-comment-above-claimed-brace",
      "export function f() {\n  a(); // trailing\n}\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, tc.source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
      main := filepath.Join(root, "src", "main.ts")

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
      if string(got) != tc.source {
        t.Fatalf("source must survive unchanged:\ngot  %q\nwant %q", string(got), tc.source)
      }
    })
  }
}

// TestCommandCheckReportsTheMalformedBraceItUsedToBless pins the second
// invariant #856 states: `ttsc check` must not call a formatting state clean
// that `ttsc format` would not produce.
//
// While the stranded brace had no owner, the mangled form was `ttsc format`'s
// own fixed point, so `check` with `format.severity: "error"` exited 0 on it —
// a CI job that ran `format` then `check` stayed green on a malformed tree.
// Now that a rule owns the brace, the same input is a finding.
func TestCommandCheckReportsTheMalformedBraceItUsedToBless(t *testing.T) {
  root := seedLintProject(t, "export function go(n: number) {\n  if (n > 0) {\n    return 1; } else {\n    return 2; }\n}\n")
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"severity": "error"},
  })
  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code == 0 || !strings.Contains(stderr, "format/indent") {
    t.Fatalf("check must report the stranded brace: code=%d stderr=%q", code, stderr)
  }
}

// TestCommandFormatStrandedBraceHonorsCRLF verifies the line break inserted
// before a claimed brace uses the file's end-of-line, not a bare LF.
//
// The brace pass inserts a break where no rule inserted one before, so it is a
// new way to reintroduce the mixed-ending defect #616 fixed. The expected
// output is the same shape as the LF case with `\r\n` throughout.
//
//  1. Seed a CRLF one-line block.
//  2. Run `ttsc format`.
//  3. Assert every inserted break is `\r\n` and no lone `\n` survives.
func TestCommandFormatStrandedBraceHonorsCRLF(t *testing.T) {
  source := "export function f(n: number) { return n; }\r\n"
  want := "export function f(n: number) {\r\n  return n;\r\n}\r\n"

  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"endOfLine": "crlf"},
  })
  main := filepath.Join(root, "src", "main.ts")

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
  if string(got) != want {
    t.Fatalf("inserted break must honor CRLF:\ngot  %q\nwant %q", string(got), want)
  }
  if strings.Contains(strings.ReplaceAll(string(got), "\r\n", ""), "\n") {
    t.Fatalf("lone LF survived a CRLF file: %q", string(got))
  }
}
