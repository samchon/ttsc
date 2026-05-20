package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverProgramFacadeReturnsSafeEmptyValues verifies the Program facade
// returns stable safe fallbacks for missing values.
//
// Public helpers are called by plugin packages that may probe for optional
// files or guard nil Programs. These branches should stay predictable instead
// of panicking or returning partially formatted diagnostics.
//
// 1. Load a real Program and request a missing SourceFile.
// 2. Call Diagnostics on a nil Program.
// 3. Assert Diagnostic.String keeps the file-only fallback form.
func TestDriverProgramFacadeReturnsSafeEmptyValues(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
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
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  if got := prog.SourceFile("missing.ts"); got != nil {
    t.Fatalf("missing source file returned %#v", got)
  }
  var nilProgram *driver.Program
  nilDiags := nilProgram.Diagnostics()
  if len(nilDiags) != 1 || !strings.Contains(nilDiags[0].Message, "nil program") {
    t.Fatalf("nil diagnostics mismatch: %#v", nilDiags)
  }
  plain := driver.Diagnostic{File: "index.ts", Message: "plain"}.String()
  if plain != "index.ts: plain" {
    t.Fatalf("file-only diagnostic string mismatch: %q", plain)
  }
}
