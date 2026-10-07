package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixOwnsItsSourceReachedThroughALink verifies that fix writes an
// owned source selected through an actual directory symlink.
//
// The tsconfig selects src/main.ts and src points to real-src. Successful
// command completion and the exact backing-file result observe ownership
// through that link. The test does not inspect the Program's chosen spelling,
// force the alternate-spelling fallback or certify junction/short-name cases.
//
//  1. Point the tsconfig at `src/main.ts` where `src` is a link.
//  2. Run fix with no-var enabled.
//  3. Assert the command succeeds and the backing file was rewritten.
//
// @evidence contracts/testing.md#behavioral-verification The in-process fix command follows src as a directory link and rewrites its owned backing main.ts, finishing without diagnostics.
// @evidence contracts/testing.md#independent-expectations The independently authored let result preserves the initializer and JSON.stringify call; exact exit/stdout/stderr require a successful fix cycle.
// @evidence contracts/testing.md#distinguishing-cases A real symlink-selected source must remain writable, with ordinary and imported-sibling ownership covered by command siblings. The test skips when native link creation fails; it does not require a particular Program path spelling or cover junctions and short names.
// @evidence contracts/testing.md#execution-ownership TestCommandFixOwnsItsSourceReachedThroughALink calls run inside captureCommandOutput over a temporary project; os.Symlink is the native filesystem boundary, with no child host or install.
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
    "var legacy = 1;\nJSON.stringify(legacy);\nexport {};\n",
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
    "let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n",
  )
}
