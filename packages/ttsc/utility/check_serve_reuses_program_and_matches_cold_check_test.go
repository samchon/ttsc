package utility

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCheckServeReusesProgramAndMatchesColdCheck verifies the utility host's
// resident analysis check keeps one Program across compatible edits and
// answers exactly what one-shot check answers (#1864).
//
// The watch launcher trusts each reply's status, diagnostics, file list and
// completeness acknowledgement in place of a cold check, so every reply must
// equal a cold RunCheckWithIO of the same files.
//
//  1. Run a failing cycle and require one load, the acknowledgement and the
//     source in the reported files.
//  2. Fix the source, then break it again, requiring incremental updates whose
//     status and diagnostics equal a cold check each time.
//  3. Add a new root and require the next cycle to load again.
//
// @evidence contracts/testing.md#behavioral-verification Real checkServeState cycles must match cold RunCheckWithIO status and stderr after each edit, report growing update counts while reused, list the checked source, acknowledge complete reports and reload for an unknown root; a stale Program, a missing acknowledgement or a missed reload fails an assertion.
// @evidence contracts/testing.md#independent-expectations Cold RunCheckWithIO of the same files is the differential oracle for diagnostics; load and update counts follow the protocol (one load, one update per compatible edit, a load for a new root).
// @evidence contracts/testing.md#distinguishing-cases Owns failing, passing and failing-again resident cycles and an unknown-root reload without linked plugins; TestCheckServeReloadsWhenProgramPluginLinked owns the AST-mutating hook case.
// @evidence contracts/testing.md#execution-ownership Drives checkServeState in the Go test process against a temporary project; no daemon process, stdin framing or built binary is started.
func TestCheckServeReusesProgramAndMatchesColdCheck(t *testing.T) {
  root := writeCheckServeProject(t, "export const value: number = 'text';\n")
  source := filepath.Join(root, "src", "main.ts")
  args := []string{"--cwd", root}
  base, ok := parseHostOptions("check-serve", args, nil, nil)
  if !ok {
    t.Fatal("check-serve options rejected")
  }
  base.noEmit = true
  state := &checkServeState{base: base}
  defer state.close()

  first := serveCheckLine(t, state, checkServeRequest{})
  if first.Status != 2 || !first.TypeScriptDiagnosticsReported ||
    first.Telemetry.ProgramLoads != 1 || first.Telemetry.Reused {
    t.Fatalf("first cycle = %#v", first)
  }
  if !reportsFile(first.ProgramFiles, source) {
    t.Fatalf("program files omit %s: %v", source, first.ProgramFiles)
  }
  assertColdCheck(t, args, first)

  for index, text := range []string{
    "export const value: number = 1;\n",
    "export const value: number = 'again';\n",
  } {
    writeCheckServeFile(t, source, text)
    cycle := serveCheckLine(t, state, checkServeRequest{Changed: []string{source}})
    if !cycle.Telemetry.Reused || cycle.Telemetry.ProgramLoads != 1 ||
      cycle.Telemetry.ProgramUpdates != index+1 || !cycle.TypeScriptDiagnosticsReported {
      t.Fatalf("incremental cycle %d = %#v", index, cycle)
    }
    assertColdCheck(t, args, cycle)
  }

  added := filepath.Join(root, "src", "added.ts")
  writeCheckServeFile(t, added, "export const added = 1;\n")
  reloaded := serveCheckLine(t, state, checkServeRequest{Changed: []string{added}})
  if reloaded.Telemetry.Reused || reloaded.Telemetry.ProgramLoads != 2 ||
    !reportsFile(reloaded.ProgramFiles, added) {
    t.Fatalf("new root cycle = %#v", reloaded)
  }
}

func serveCheckLine(t *testing.T, state *checkServeState, req checkServeRequest) checkServeResponse {
  t.Helper()
  line, err := json.Marshal(req)
  if err != nil {
    t.Fatal(err)
  }
  return state.handle(string(line))
}

func assertColdCheck(t *testing.T, args []string, resident checkServeResponse) {
  t.Helper()
  var stdout, stderr bytes.Buffer
  status := RunCheckWithIO(args, &stdout, &stderr)
  if status != resident.Status || stderr.String() != resident.Stderr {
    t.Fatalf("resident/cold mismatch\nresident=%#v\ncold=(%d,%q)", resident, status, stderr.String())
  }
}

// reportsFile compares slash spellings without case, since a Windows drive
// letter may be spelled differently by the temporary-directory API.
func reportsFile(files []string, want string) bool {
  want = filepath.ToSlash(want)
  for _, file := range files {
    if strings.EqualFold(filepath.ToSlash(file), want) {
      return true
    }
  }
  return false
}

func writeCheckServeProject(t *testing.T, main string) string {
  t.Helper()
  root := t.TempDir()
  writeCheckServeFile(t, filepath.Join(root, "tsconfig.json"),
    `{"compilerOptions":{"strict":true,"noEmit":true,"skipLibCheck":true},"include":["src"]}`)
  writeCheckServeFile(t, filepath.Join(root, "src", "main.ts"), main)
  return root
}

func writeCheckServeFile(t *testing.T, file, text string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
    t.Fatal(err)
  }
}
