package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatConvergesOnLeadingSemiGuardInCallback verifies the
// `ttsc format` cascade converges on a leading-semicolon ASI guard inside
// a reflowed callback body.
//
// Orphan-semi merges the guard onto its statement. Statement-split and the
// block printer must preserve that adjacency through the remaining cascade.
// Exact first-run output preserves the Promise callback, assignment and ASI
// guard; the second invocation must leave the same complete file unchanged.
//
//  1. Seed (semi:false) a `new Promise` callback whose body opens with a
//     standalone `;` guard before a `(`-leading statement.
//  2. Run `ttsc format`.
//  3. Assert it exits cleanly (converges), merges the guard, and is
//     idempotent on a second run.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command (semi false) twice on a `new Promise` callback whose body is a standalone `;` line followed by `(x as Y).z = r`; the first run must exit 0 without a did-not-converge message and the file must contain `;(x as Y).z = r`, the second run must exit 0 and leave the file identical.
// @evidence contracts/testing.md#independent-expectations The authored complete expected file keeps the Promise callback and assignment intact while placing the required ASI semicolon directly before the parenthesized statement. Exact first-run equality establishes the intended change independently; second-run equality separately observes stability.
// @evidence contracts/testing.md#distinguishing-cases A separated guard must become adjacent on the first call and remain adjacent on the second. Full first-run bytes distinguish surrounding-source damage, while the original substring, non-convergence and second-pass checks remain.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand twice against a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatConvergesOnLeadingSemiGuardInCallback(t *testing.T) {
  source := "const p = new Promise((r) => {\n" +
    "  ;\n" +
    "  (x as Y).z = r\n" +
    "})\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"semi": false},
  })
  main := filepath.Join(root, "src", "main.ts")

  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 0 || strings.Contains(stderr, "did not converge") {
    t.Fatalf("format did not converge: code=%d stderr=%q", code, stderr)
  }
  first, err := os.ReadFile(main)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  const expected = "const p = new Promise((r) => {\n  ;(x as Y).z = r\n})\n"
  if string(first) != expected {
    t.Fatalf("guard merge changed surrounding source: got %q want %q", string(first), expected)
  }
  if !strings.Contains(string(first), ";(x as Y).z = r") {
    t.Fatalf("guard not merged onto its statement:\n%s", string(first))
  }

  // Second run must be a no-op (true fixed point).
  code2, _, _ := captureCommandOutput(t, func() int {
    return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  second, err := os.ReadFile(main)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if code2 != 0 || string(second) != string(first) {
    t.Fatalf("format not idempotent on guard: code=%d\nfirst  %q\nsecond %q", code2, string(first), string(second))
  }
}
