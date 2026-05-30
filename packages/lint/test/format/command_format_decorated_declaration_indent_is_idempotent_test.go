package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatDecoratedDeclarationIndentIsIdempotent verifies the FIX C
// decorated-declaration re-indent is a fixed point: an already-correct
// decorated nested class declaration is left byte-for-byte unchanged, and a
// second `ttsc format` pass produces the identical result (format twice ==
// once). ttsc-only self-check.
//
// The statement pass re-indents decorated declarations through
// reindentHeaderLine, which is a no-op when a line's leading run already
// equals the target. This pins that no-op so the new path cannot oscillate
// against print-width / semi on converged input.
//
//  1. Seed a project whose source is already the canonical decorated layout.
//  2. Run `ttsc format` twice.
//  3. Assert each run exits cleanly and the file is unchanged both times.
func TestCommandFormatDecoratedDeclarationIndentIsIdempotent(t *testing.T) {
  canonical := "function f() {\n" +
    "  @Dec\n" +
    "  class B {\n" +
    "    m() {\n" +
    "      g()\n" +
    "    }\n" +
    "  }\n" +
    "  return B\n" +
    "}\n"
  root := seedLintProject(t, canonical)
  seedLintConfig(t, root, map[string]any{"format": map[string]any{"semi": false}})
  main := filepath.Join(root, "src", "main.ts")

  for pass := 0; pass < 2; pass++ {
    code, _, stderr := captureCommandOutput(t, func() int {
      return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t)})
    })
    if code != 0 {
      t.Fatalf("pass %d: format exited %d stderr=%q", pass, code, stderr)
    }
    got, err := os.ReadFile(main)
    if err != nil {
      t.Fatalf("pass %d: ReadFile: %v", pass, err)
    }
    if string(got) != canonical {
      t.Fatalf("pass %d: decorated declaration indent not idempotent:\ngot  %q\nwant %q", pass, string(got), canonical)
    }
  }
}
