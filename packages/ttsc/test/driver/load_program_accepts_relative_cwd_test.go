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
// instead of an absolute path. The driver should resolve that cwd before
// locating tsconfig and source files.
//
// 1. Create a project directory under a temp parent and chdir into the parent.
// 2. Load it with the relative cwd "project".
// 3. Assert a Program is produced without diagnostics (the tsconfig and its
//    source file were found; the resolved path itself is not inspected).
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
