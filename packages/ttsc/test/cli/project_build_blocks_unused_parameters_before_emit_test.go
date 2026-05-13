package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProjectBuildBlocksUnusedParametersBeforeEmit verifies unused
// parameters remain fatal diagnostics.
//
// The compiler host should not weaken normal TypeScript semantic checks while
// preserving overload-specific behavior. A real unused implementation parameter
// must stop forced emit when noUnusedParameters is enabled.
//
// This scenario exercises the fatal semantic diagnostic lane through the CLI.
// The emitted file assertion confirms the failure happens before output is
// written.
//
// 1. Create a strict project with noUnusedParameters enabled.
// 2. Build with forced emit through the native command.
// 3. Assert the unused parameter diagnostic appears and no JS is emitted.
func TestCLIProjectBuildBlocksUnusedParametersBeforeEmit(t *testing.T) {
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

  code, _, stderr := runNativeCommand(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("expected exit 2, got %d stderr=%q", code, stderr)
  }
  if !strings.Contains(stderr, "'unused' is declared but its value is never read") &&
    !strings.Contains(stderr, "'unused' is declared but never used") {
    t.Fatalf("expected unused parameter diagnostic, got %q", stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("expected no emitted JS, stat err=%v", err)
  }
}
