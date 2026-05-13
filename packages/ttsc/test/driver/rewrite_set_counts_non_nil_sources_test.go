package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteSetCountsNonNilSources verifies RewriteSet ignores invalid
// rewrites and counts valid source-associated patches.
//
// Rewrite collectors can skip individual call sites, so the set must tolerate
// nil files while still preserving valid source-associated entries.
//
// 1. Add a rewrite without a source file and confirm it is ignored.
// 2. Load a real project and add one source-associated rewrite.
// 3. Assert Len reports only the valid rewrite.
func TestDriverRewriteSetCountsNonNilSources(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: RewriteSet.Add must be tolerant because collectors may
  // skip or fail individual call sites before registering final rewrites.
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{RootName: "missing", Method: "call"})
  if rewrites.Len() != 0 {
    t.Fatalf("nil-file rewrite should be ignored, got len=%d", rewrites.Len())
  }
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Count assertion: the valid source file is the only rewrite counted.
  rewrites.Add(driver.Rewrite{File: prog.SourceFiles()[0], RootName: "plugin", Method: "make"})
  if rewrites.Len() != 1 {
    t.Fatalf("expected one valid rewrite, got %d", rewrites.Len())
  }
}
