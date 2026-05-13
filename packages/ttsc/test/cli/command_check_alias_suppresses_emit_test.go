package ttsc_test

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCLICommandCheckAliasSuppressesEmit verifies `ttsc check` forces the
// analysis-only build lane.
//
// The check alias prepends `--noEmit` before delegating to the same build
// implementation. A project with a configured outDir makes the no-write
// behavior observable without inspecting unexported command state.
//
// 1. Create a project that would emit JavaScript during a normal build.
// 2. Execute the `check` alias through the native command.
// 3. Assert the command succeeds and leaves the outDir empty.
func TestCLICommandCheckAliasSuppressesEmit(t *testing.T) {
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
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  code, out, errOut := runNativeCommand(t, "check", "--cwd", root)
  if code != 0 {
    t.Fatalf("check alias failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
    t.Fatalf("check alias should not emit JavaScript: %v", err)
  }
}
