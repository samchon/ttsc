package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestFileDiagnosticsReportCodeColumnAndMessage verifies that FileDiagnostics
// reports the literal code, line, binding column and message fragment expected
// for the authored bad assignment. It does not compare complete diagnostic text
// or invoke a separate tsgo reference process.
//
// The existing match-code-and-location probe pins Line and Code; this one
// strengthens the contract to Column and Message so a regression that kept the
// right code but lost the binding column or message fragment is caught.
// The expected assignability location is the declared
// binding, so on `export const broken: number = "nope";` the diagnostic sits at
// `broken` — 1-based column 14 (`export const ` is 13 characters).
//
//  1. Compile a fixture whose only file assigns a string to a number binding.
//  2. Ask FileDiagnostics for that file.
//  3. Assert the TS2322 diagnostic sits at line 1 / column 14 and its message
//     contains "not assignable".
//
// @evidence contracts/testing.md#behavioral-verification Actual FileDiagnostics must include TS2322 at line 1 column 14 with a not assignable message fragment. Complete text, end positions, severity, record count and independent CLI equivalence are not asserted.
// @evidence contracts/testing.md#independent-expectations Literal TS2322, line 1, column 14 and not assignable expectations follow the authored string-to-number assignment; the binding broken follows 13 source characters. They are not computed from FileDiagnostics, but this entry has no separate reference compiler output and cannot independently authenticate its entire acquisition path.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture whose only file assigns a string to a number binding; Ask FileDiagnostics for that file; Assert the TS2322 diagnostic sits at line 1 / column 14 and its message contains "not assignable".
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native one-file project, loads/closes its driver Program in-process and calls FileDiagnostics, which acquires whole-Program diagnostics then filters exact File. A restored empty linked-plugin manifest excludes ambient hooks; no consumer installation or product process runs. The match-code-and-location entry owns the absent-path counterpart.
func TestFileDiagnosticsReportCodeColumnAndMessage(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
