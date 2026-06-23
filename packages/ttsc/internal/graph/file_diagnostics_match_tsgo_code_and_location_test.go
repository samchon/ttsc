package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestFileDiagnosticsMatchTsgoCodeAndLocation verifies that FileDiagnostics
// surfaces the same semantic error code and line tsgo emits, scoped to one file.
// This is validation gate 4 from issue #259: a deliberate type error must yield
// the exact tsc code/location from the graph's shared Program, proving the
// diagnostics path is the real checker and not a re-implementation.
//
//  1. Compile a fixture whose only file assigns a string to a number binding.
//  2. Ask FileDiagnostics for that file.
//  3. Assert a TS2322 (not assignable) diagnostic on line 1, and that an
//     unrelated path yields none.
func TestFileDiagnosticsMatchTsgoCodeAndLocation(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export const broken: number = "not a number";
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  // LoadProgram reports only config/parse diagnostics; the type error is
  // syntactically valid, so it surfaces through Program.Diagnostics() instead.
  if len(diags) != 0 {
    t.Fatalf("unexpected parse diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  main := sourceFile(t, prog, "main.ts").FileName()
  got := FileDiagnostics(prog, main)

  var match *driver.Diagnostic
  for i := range got {
    if got[i].Code == 2322 {
      match = &got[i]
      break
    }
  }
  if match == nil {
    t.Fatalf("expected a TS2322 diagnostic for the bad assignment, got %v", got)
  }
  if match.Line != 1 {
    t.Fatalf("TS2322 reported on line %d, expected line 1", match.Line)
  }
  if match.File != main {
    t.Fatalf("diagnostic file %q is not the queried file %q", match.File, main)
  }
  if other := FileDiagnostics(prog, filepath.Join(root, "src", "absent.ts")); len(other) != 0 {
    t.Fatalf("a file with no diagnostics returned %d", len(other))
  }
}
