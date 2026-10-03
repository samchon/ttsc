package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestFileDiagnosticsMatchTsgoCodeAndLocation verifies that FileDiagnostics
// retains the selected Program finding's literal code, line and queried file,
// while an absent file returns none. FileDiagnostics queries whole-Program
// diagnostics before exact-file filtering; this entry runs no reference CLI.
//
//  1. Compile a fixture whose only file assigns a string to a number binding.
//  2. Ask FileDiagnostics for that file.
//  3. Assert a TS2322 (not assignable) diagnostic on line 1, and that an
//     unrelated path yields none.
//
// @evidence contracts/testing.md#behavioral-verification The actual FileDiagnostics result must include TS2322 at line 1 with File equal to the queried resident source; querying the absent src/absent.ts must return no records. Column, message, severity and complete finding count are not asserted here.
// @evidence contracts/testing.md#independent-expectations The authored string-to-number assignment has literal TS2322 and line 1 expectations, while the absent-path expectation is zero findings. The queried resident filename is supplied by the actual Program; no separate tsgo process or complete independent diagnostic oracle authenticates acquisition.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture whose only file assigns a string to a number binding; Ask FileDiagnostics for that file; Assert a TS2322 (not assignable) diagnostic on line 1, and that an unrelated path yields none.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native one-file project, loads/closes its driver Program in-process and calls FileDiagnostics twice. The adapter acquires whole-Program diagnostics before exact File filtering, so the query path is not a checker-work boundary. A restored empty linked-plugin manifest excludes ambient hooks; no consumer installation or product process runs.
func TestFileDiagnosticsMatchTsgoCodeAndLocation(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
