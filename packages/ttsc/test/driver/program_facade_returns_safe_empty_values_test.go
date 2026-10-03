package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverProgramFacadeReturnsSafeEmptyValues Verifies that Program facade returns nil for a missing file, one nil-program diagnostic, and the file-only string form.
//
// A live missing-file query contrasts with a nil receiver and location-less Diagnostic.
//
// 1. Load a real Program and request a missing SourceFile.
// 2. Call Diagnostics on a nil Program.
// 3. Assert Diagnostic.String keeps the file-only fallback form.
//
// @evidence contracts/testing.md#behavioral-verification Program facade returns nil for a missing file, one nil-program diagnostic, and the file-only string form.
// @evidence contracts/testing.md#independent-expectations The authored absent file and defensive and formatting contracts define expectations.
// @evidence contracts/testing.md#distinguishing-cases A live missing-file query contrasts with a nil receiver and location-less Diagnostic.
// @evidence contracts/testing.md#execution-ownership The entry loads and closes a Go Program and directly calls public facade methods. Go discovers TestDriverProgramFacadeReturnsSafeEmptyValues under ./test/driver.
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
