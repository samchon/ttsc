package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteSetCountsNonNilSources Verifies that RewriteSet ignores a nil-source entry and counts the later valid source entry.
//
// Nil rejection contrasts with singleton acceptance; repeated valid entries are not exercised.
//
// 1. Add a rewrite without a source file and confirm it is ignored.
// 2. Load a real project and add one source-associated rewrite.
// 3. Assert Len reports only the valid rewrite.
//
// @evidence contracts/testing.md#behavioral-verification RewriteSet ignores a nil-source entry and counts the later valid source entry.
// @evidence contracts/testing.md#independent-expectations Two authored entries define zero and one counts independently of set storage.
// @evidence contracts/testing.md#distinguishing-cases Nil rejection contrasts with singleton acceptance; repeated valid entries are not exercised.
// @evidence contracts/testing.md#execution-ownership The Go entry operates directly on RewriteSet and closes its temporary Program. Go discovers TestDriverRewriteSetCountsNonNilSources under ./test/driver.
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
