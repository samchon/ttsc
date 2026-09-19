package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckAppliesAForwardedNullReset verifies a forwarded `null` resets
// the tsconfig's option in the in-process lint program, as it does in
// TypeScript-Go's own command line.
//
// The launcher keeps a private build's outputs in one directory by forwarding
// `--declarationDir null` and its siblings. The parsed CompilerOptions cannot
// carry a reset, so the config's own value survived the merge: beside a
// forwarded `--declaration false` the program reported TS5069 for a
// `declarationDir` the command line had cleared. The raw command-line options
// carry the explicit null into the merge. The twin without the reset pins that
// the config's value is otherwise kept.
//
//  1. Create a project whose tsconfig declares `declaration` and a
//     `declarationDir`.
//  2. Run `check` forwarding `--declaration false` with and without
//     `--declarationDir null`.
//  3. Assert the reset run passes and the other reports TS5069.
func TestCommandCheckAppliesAForwardedNullReset(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noEmit": true,
    "declaration": true,
    "declarationDir": "types"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), "export const value: number = 1;\n")

  check := func(tsgoArgs string) (int, string) {
    code, _, stderr := captureCommandOutput(t, func() int {
      return run([]string{"check", "--cwd", root, "--tsgo-args", tsgoArgs})
    })
    return code, stderr
  }

  code, stderr := check(`["--declaration","false","--declarationDir","null"]`)
  if code != 0 || strings.Contains(stderr, "TS5069") {
    t.Fatalf("the forwarded reset did not apply: code=%d stderr=%q", code, stderr)
  }
  code, stderr = check(`["--declaration","false"]`)
  if code != 2 || !strings.Contains(stderr, "TS5069") {
    t.Fatalf("the config's declarationDir was dropped without a reset: code=%d stderr=%q", code, stderr)
  }
}
