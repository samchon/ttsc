package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDumpDiagnosticsRideTheGenerationThatBuiltIt supplies findings from the
// same compiler Program used for Build and checks one diagnostic's dump fields.
// Omitting that supplied origin produces a non-nil empty diagnostics list.
// This does not compare different generations or exercise a consumer request.
//
//  1. Build a fixture whose only file assigns a string to a number binding.
//  2. Dump it.
//  3. Assert the TS2322 sits in the dump, at the location tsgo reports, against
//     a project-relative path.
//
// @evidence contracts/testing.md#behavioral-verification Build and NewDiagnostics use the same authored compiler Program; NewDump must retain a TS2322 with the selected location, message, severity and relative file. A second dump without supplied diagnostics must contain a non-nil empty list. Cross-generation rejection and consumer queries are not exercised.
// @evidence contracts/testing.md#independent-expectations The string-to-number assignment has literal TS2322, line 1, column 14, error category, not assignable message fragment and src/main.ts expectations. Omitted diagnostics have literal empty-list expectations. These are supplied expectations rather than results generated from NewDump, but they do not independently authenticate the compiler's complete diagnostic output or origin.
// @evidence contracts/testing.md#distinguishing-cases Build a fixture whose only file assigns a string to a number binding; Dump it; Assert the TS2322 sits in the dump, at the location tsgo reports, against a project-relative path.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes a native project, constructs and closes its driver compiler Program in-process, and directly calls Build, NewDump, SourceTexts and NewDiagnostics. A restored empty linked-plugin manifest excludes ambient hooks. No consumer installation or native product command runs.
func TestDumpDiagnosticsRideTheGenerationThatBuiltIt(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export const broken: number = "nope";
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  dump, err := NewDump(Build(prog), root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{
    Diagnostics: NewDiagnostics(prog),
  })
  if err != nil {
    t.Fatal(err)
  }

  var match *Diagnostic
  for i := range dump.Diagnostics {
    if dump.Diagnostics[i].Code == 2322 {
      match = &dump.Diagnostics[i]
      break
    }
  }
  if match == nil {
    t.Fatalf("the dump carried no TS2322 for the bad assignment: %v", dump.Diagnostics)
  }
  // The same oracle the FileDiagnostics probe uses: tsgo attributes the
  // assignability error to the declared binding, 1-based column 14.
  if match.Line != 1 || match.Column != 14 {
    t.Fatalf("TS2322 at line %d column %d, expected line 1 column 14", match.Line, match.Column)
  }
  if !strings.Contains(match.Message, "not assignable") {
    t.Fatalf("TS2322 message %q does not mention 'not assignable'", match.Message)
  }
  if match.Category != "error" {
    t.Fatalf("TS2322 category %q, want error", match.Category)
  }
  // Paths on the wire are project-relative; an absolute one would leak the
  // producer's disk layout into a document a consumer reads elsewhere.
  if match.File != "src/main.ts" {
    t.Fatalf("diagnostic file %q, want the project-relative src/main.ts", match.File)
  }

  // The negative twin: a caller that does not collect diagnostics publishes an
  // empty list, never a nil that would encode as JSON null.
  quiet, err := NewDump(Build(prog), root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{})
  if err != nil {
    t.Fatal(err)
  }
  if quiet.Diagnostics == nil {
    t.Fatal("an uncollected diagnostics list is nil, so it serializes as null rather than []")
  }
  if len(quiet.Diagnostics) != 0 {
    t.Fatalf("an uncollected diagnostics list invented %d entries", len(quiet.Diagnostics))
  }
}
