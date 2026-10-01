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
//
// @evidence contracts/testing.md#behavioral-verification in-process run(fix) returns exit zero with empty stdout/stderr and the exact authored canonical file on both passes.
// @evidence contracts/testing.md#independent-expectations The authored whole-file expected string specifies the supported dollar-brace escape transformation; exact first-pass equality establishes correctness before second-pass convergence.
// @evidence contracts/testing.md#distinguishing-cases Both malformed escape spellings change, real expression substitution and canonical escape remain intact, and the second command invocation preserves the same bytes.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the owning command function directly against t.TempDir fixture configuration/files; it does not install a consumer, build a native artifact or spawn a product process.
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
