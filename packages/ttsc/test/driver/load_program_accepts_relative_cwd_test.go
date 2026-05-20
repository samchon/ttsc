package driver_test

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramAcceptsRelativeCwd verifies LoadProgram accepts relative cwd
// values.
//
// Command callers may pass a project directory relative to the current process
// instead of an absolute path. The driver should normalize that cwd before
// resolving tsconfig and source files.
//
// 1. Create a project under the current working directory.
// 2. Load it with a relative cwd.
// 3. Assert a Program is produced without diagnostics.
func TestLoadProgramAcceptsRelativeCwd(t *testing.T) {
  parent := t.TempDir()
  project := filepath.Join(parent, "project")
  writeProjectFile(t, project, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, project, "index.ts", `export const value = 1;
`)

  previous, err := os.Getwd()
  if err != nil {
    t.Fatal(err)
  }
  if err := os.Chdir(parent); err != nil {
    t.Fatal(err)
  }
  defer os.Chdir(previous)

  prog, diags, err := driver.LoadProgram("project", "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  if prog == nil {
    t.Fatal("expected program")
  }
  defer prog.Close()
}
