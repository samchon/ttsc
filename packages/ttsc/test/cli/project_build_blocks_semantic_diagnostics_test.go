package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProjectBuildBlocksSemanticDiagnostics verifies project builds stop
// before emit when TypeScript reports semantic errors.
//
// The fixture contains valid syntax with an invalid assignment, so the failure
// must come from the semantic checker rather than parsing or config loading.
// Forced emit should still stop before any JavaScript file is written.
//
// 1. Create a strict project with a known assignment error.
// 2. Run the build command with `--emit`.
// 3. Assert the diagnostic is printed and no JavaScript is written.
func TestCLIProjectBuildBlocksSemanticDiagnostics(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: using a semantic type mismatch exercises the checker path,
  // not only the config parser or syntax parser.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `const value: string = 123;
console.log(value);
`)

  // Failure assertion: the command must reject before WriteFile can create the
  // configured output path.
  code, _, errOut := runNativeCommand(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("semantic build should fail: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(errOut, "Type 'number' is not assignable to type 'string'") {
    t.Fatalf("semantic diagnostic missing expected message: %q", errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("semantic failure should not emit JavaScript: %v", err)
  }
}
