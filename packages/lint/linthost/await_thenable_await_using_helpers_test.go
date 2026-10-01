package linthost

import (
  "path/filepath"
  "testing"
)

// seedAwaitUsingLintProject materializes an await-using fixture with the
// standard explicit-resource-management declarations supplied by TypeScript.
// Keeping the protocol library in compiler configuration prevents the fixture
// from replacing global Disposable contracts with partial local declarations.
func seedAwaitUsingLintProject(t *testing.T, source string) string {
  t.Helper()
  root := seedLintProject(t, source)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "ESNext.Disposable"]
  },
  "files": ["src/main.ts"]
}
`)
  return root
}

// assertAwaitUsingProjectTypeChecks proves fixture prerequisites independently
// of lint by invoking the real check front door with no lint plugin entry.
func assertAwaitUsingProjectTypeChecks(t *testing.T, root string) {
  t.Helper()
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", "[]",
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("await-using fixture does not type-check: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
