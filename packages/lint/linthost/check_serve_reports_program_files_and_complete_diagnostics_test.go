package linthost

import (
  "path/filepath"
  "slices"
  "strings"
  "testing"
)

// TestCheckServeReportsProgramFilesAndCompleteDiagnostics verifies check-serve
// replies name the resident Program's files and acknowledge a complete
// diagnostic report, including on a failing cycle (#1865, #1869).
//
// The launcher uses the file list instead of listing the project again and the
// acknowledgement instead of a recovery check, so both must describe the
// Program the reply checked and must be absent when no Program report exists.
//
//  1. Run a failing no-var cycle and require the acknowledgement with status 2
//     and a file list naming the project source.
//  2. Add an import of a new file and require the next reply's list to name it.
//  3. Break the lint config and require a reply with neither field.
//
// @evidence contracts/testing.md#behavioral-verification Real residentCheckState cycles must report the checked Program's files and the acknowledgement on passing and failing reports, extend the list when an import adds a member, and omit both when rule loading fails before any Program report.
// @evidence contracts/testing.md#independent-expectations Expected members are the files the test wrote and imported; the acknowledgement follows from a formatted Program report, and its absence from the config failure the test introduces.
// @evidence contracts/testing.md#distinguishing-cases Owns the new reply fields across a failing report, a membership change and a pre-report failure; TestCheckServeReusesProgramAndMatchesColdCycles owns reuse telemetry and cold equivalence.
// @evidence contracts/testing.md#execution-ownership Drives residentCheckState in the Go test process against a temporary project; no daemon process or built binary is started.
func TestCheckServeReportsProgramFilesAndCompleteDiagnostics(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1;\nJSON.stringify(legacy);\n")
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  base, err := parseSubcommandFlagsWithIO(
    "check-serve",
    []string{"--cwd", root, "--plugins-json", lintManifest(t)},
    nil,
    nil,
  )
  if err != nil {
    t.Fatal(err)
  }
  base.noEmit = true
  state := &residentCheckState{}
  defer state.close()

  source := filepath.Join(root, "src", "main.ts")
  first := state.run(base, false)
  if first.Status != 2 || !first.TypeScriptDiagnosticsReported {
    t.Fatalf("failing cycle must acknowledge its report: %#v", first)
  }
  if !containsFile(first.ProgramFiles, source) {
    t.Fatalf("program files omit %s: %v", source, first.ProgramFiles)
  }

  added := filepath.Join(root, "src", "added.ts")
  writeFile(t, added, "export const added = 1;\n")
  writeFile(
    t,
    source,
    "import { added } from \"./added\";\nvar legacy = added;\nJSON.stringify(legacy);\n",
  )
  second := state.run(
    base,
    state.apply(serveCheckRequest{Changed: []string{source}}),
  )
  if !second.TypeScriptDiagnosticsReported || !containsFile(second.ProgramFiles, added) {
    t.Fatalf("membership change not reported: %#v", second)
  }

  writeFile(t, filepath.Join(root, "lint.config.json"), "{ not json")
  broken := state.run(
    base,
    state.apply(serveCheckRequest{Changed: []string{source}}),
  )
  if broken.Status == 0 || broken.TypeScriptDiagnosticsReported {
    t.Fatalf("config failure must not acknowledge a report: %#v", broken)
  }
}

// containsFile compares slash spellings; a Windows drive letter may differ in
// case between the temporary-directory API and the compiler's file names.
func containsFile(files []string, want string) bool {
  want = filepath.ToSlash(want)
  return slices.ContainsFunc(files, func(file string) bool {
    return strings.EqualFold(filepath.ToSlash(file), want)
  })
}
