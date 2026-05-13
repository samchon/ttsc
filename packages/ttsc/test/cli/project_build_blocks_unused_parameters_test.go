package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProjectBuildBlocksUnusedParameters verifies no-unused diagnostics stop
// emit before generated JavaScript is written.
//
// The build command checks diagnostics before entering the emit callback. A
// noUnusedParameters project gives a small semantic failure that should remain
// build-blocking.
//
// 1. Create a strict project with an unused function parameter.
// 2. Execute `build --emit` through the native command.
// 3. Assert the unused diagnostic is printed and no JavaScript is emitted.
func TestCLIProjectBuildBlocksUnusedParameters(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true,
    "noUnusedParameters": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export function run(unused: string): number {
  return 1;
}
`)

  code, _, errOut := runNativeCommand(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("unused-parameter build should fail: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(errOut, "'unused' is declared but its value is never read") &&
    !strings.Contains(errOut, "'unused' is declared but never used") {
    t.Fatalf("unused-parameter diagnostic missing expected message: %q", errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("unused-parameter failure should not emit JavaScript: %v", err)
  }
}
