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
// format/orphan-semi merges `;\n(expr)` onto one line; both
// format/statement-split and format/print-width's block printer used to
// re-split it, so the cascade ping-ponged forever and exited non-zero
// (the "did not converge" path). With statement-split skipping the guard
// and the block printer keeping it glued, the cascade settles.
//
//  1. Seed (semi:false) a `new Promise` callback whose body opens with a
//     standalone `;` guard before a `(`-leading statement.
//  2. Run `ttsc format`.
//  3. Assert it exits cleanly (converges), merges the guard, and is
//     idempotent on a second run.
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
