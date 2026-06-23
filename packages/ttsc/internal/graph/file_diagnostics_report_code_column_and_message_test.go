package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestFileDiagnosticsReportCodeColumnAndMessage verifies that FileDiagnostics
// surfaces the full tsgo-reported location and text of a type error, not just
// its code and line: the column points at the offending initializer and the
// message carries the human-readable reason.
//
// The existing match-code-and-location probe pins Line and Code; this one
// strengthens the contract to Column and Message so a regression that kept the
// right code but lost the precise span (or the text) is caught. The oracle is
// the real checker: tsgo attributes the assignability error to the declared
// binding, so on `export const broken: number = "nope";` the diagnostic sits at
// `broken` — 1-based column 14 (`export const ` is 13 characters).
//
//  1. Compile a fixture whose only file assigns a string to a number binding.
//  2. Ask FileDiagnostics for that file.
//  3. Assert the TS2322 diagnostic sits at line 1 / column 14 and its message
//     contains "not assignable".
func TestFileDiagnosticsReportCodeColumnAndMessage(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export const broken: number = "nope";
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  // The bad assignment is syntactically valid, so it surfaces through
  // Program.Diagnostics() rather than the config/parse diagnostics LoadProgram
  // returns.
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
  // Oracle column: tsgo attributes the assignability error to the declared
  // binding `broken`, which begins at the 14th character of the line.
  if match.Column != 14 {
    t.Fatalf("TS2322 reported at column %d, expected column 14 (the binding)", match.Column)
  }
  if !strings.Contains(match.Message, "not assignable") {
    t.Fatalf("TS2322 message %q does not mention 'not assignable'", match.Message)
  }
}
