package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFixUnicornConsistentTemplateLiteralEscapeConvergesAndIsIdempotent
// verifies `ttsc fix` canonicalizes the escapes once and then leaves the
// file alone.
//
// The corpus regression shield demands the real command path, not just
// the in-memory engine: `fix` reloads a fresh Program from disk between
// passes, so a fix that reintroduces a reportable spelling (or a scan
// that fires on its own output) would rewrite the file forever. Two
// passes over the same project must yield the identical canonical file
// and exit clean.
//
//  1. Seed a lint project whose template mixes both bad spellings, a real
//     substitution, and a canonical escape.
//  2. Run the in-process `fix` command twice.
//  3. Assert exit 0, silent output, and the canonical file after each pass.
func TestCommandFixUnicornConsistentTemplateLiteralEscapeConvergesAndIsIdempotent(t *testing.T) {
  source := "const template = `use $\\{name} and \\$\\{other}${\"expr\"}$\\{tail} plus \\${kept}`;\nexport default template;\n"
  expected := "const template = `use \\${name} and \\${other}${\"expr\"}\\${tail} plus \\${kept}`;\nexport default template;\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{unicornConsistentTemplateLiteralEscapeRuleName: "error"})
  args := []string{"fix", "--cwd", root, "--plugins-json", lintManifest(t)}
  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("fix pass %d mismatch: code=%d stdout=%q stderr=%q", pass, code, stdout, stderr)
    }
    assertFileText(t, filepath.Join(root, "src", "main.ts"), expected)
  }
}
