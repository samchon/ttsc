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
//
// @evidence contracts/testing.md#behavioral-verification Actual check command applies declaration:false with declarationDir:null as a clean reset; omitting only the reset retains the configured directory and produces TS5069 with status two.
// @evidence contracts/testing.md#independent-expectations The authored declaration/declarationDir configuration and independently specified TypeScript option incompatibility determine opposite literal status/error outcomes; reset success requires fully empty stderr.
// @evidence contracts/testing.md#distinguishing-cases Same project and declaration:false argument with versus without an explicit null reset distinguish resetting from dropping the configuration wholesale or ignoring forwarded raw options.
// @evidence contracts/testing.md#execution-ownership Real Go command parser, compiler option merge and in-process project diagnostics execute against a temporary fixture, without a launcher, native producer, install or tsgo subprocess.
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
  if code != 0 || stderr != "" || strings.Contains(stderr, "TS5069") {
    t.Fatalf("the forwarded reset did not apply: code=%d stderr=%q", code, stderr)
  }
  code, stderr = check(`["--declaration","false"]`)
  if code != 2 || !strings.Contains(stderr, "TS5069") {
    t.Fatalf("the config's declarationDir was dropped without a reset: code=%d stderr=%q", code, stderr)
  }
}
