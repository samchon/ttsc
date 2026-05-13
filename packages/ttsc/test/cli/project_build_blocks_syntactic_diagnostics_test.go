package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProjectBuildBlocksSyntacticDiagnostics verifies parser errors stop
// emit before WriteFile runs.
//
// Semantic diagnostics are covered elsewhere; this case keeps the syntactic
// diagnostic branch visible through the command front door. The fixture has an
// outDir so accidental emit is easy to detect.
//
// 1. Create a project containing invalid TypeScript syntax.
// 2. Execute `build --emit` through the native command.
// 3. Assert the parser diagnostic is printed and no JavaScript is emitted.
func TestCLIProjectBuildBlocksSyntacticDiagnostics(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `console.log("before");
const = ;
`)

  code, _, errOut := runNativeCommand(t, "build", "--cwd", root, "--emit")
  if code != 2 {
    t.Fatalf("syntactic build should fail: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(errOut, "Variable declaration expected") {
    t.Fatalf("syntactic diagnostic missing expected message: %q", errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("syntactic failure should not emit JavaScript: %v", err)
  }
}
