package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixOwnsItsSourceReachedThroughALink verifies a project still
// writes its own file when the Program spells that file differently.
//
// A project directory can be reached through a junction, a symlink, or a
// Windows 8.3 short name, so the path the Program reports need not match the
// one the tsconfig listed. While the read scope was the file list, an alias
// mismatch simply dropped the file from every pass. Once imported TypeScript is
// admitted, the same mismatch would leave the file readable and unwritable:
// `fix` would print a diagnostic for a file it refuses to touch. Ownership
// therefore resolves the alias, and this case fails if it stops doing so.
//
//  1. Point the tsconfig at `src/main.ts` where `src` is a link.
//  2. Run fix with no-var enabled.
//  3. Assert the command succeeds and the backing file was rewritten.
func TestCommandFixOwnsItsSourceReachedThroughALink(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noEmit": true
  },
  "files": ["src/main.ts"]
}
`)
  backing := filepath.Join(root, "real-src")
  writeFile(
    t,
    filepath.Join(backing, "main.ts"),
    "var legacy = 1;\nJSON.stringify(legacy);\n",
  )
  if err := os.Symlink(backing, filepath.Join(root, "src")); err != nil {
    t.Skipf("directory link unavailable: %v", err)
  }
  seedLintRules(t, root, map[string]string{"no-var": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("fix mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertFileText(
    t,
    filepath.Join(backing, "main.ts"),
    "let legacy = 1;\nJSON.stringify(legacy);\n",
  )
}
