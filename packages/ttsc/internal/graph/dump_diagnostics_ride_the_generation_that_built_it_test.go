package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDumpDiagnosticsRideTheGenerationThatBuiltIt verifies the dump carries the
// compiler's findings for the same program that produced its nodes and edges,
// relativized like every other path on the wire.
//
// FileDiagnostics was written, tested, and then called by nothing: its own
// comment said "the dump and MCP results carry no diagnostics", so a consumer
// that wanted to know whether the code it was reading even compiles had to run a
// second compile to find out — against a program that, by then, was not this one.
// The value of riding along is precisely that the answer belongs to this
// snapshot; a diagnostics list assembled separately would be a different
// program's opinion.
//
//  1. Build a fixture whose only file assigns a string to a number binding.
//  2. Dump it.
//  3. Assert the TS2322 sits in the dump, at the location tsgo reports, against
//     a project-relative path.
func TestDumpDiagnosticsRideTheGenerationThatBuiltIt(t *testing.T) {
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
