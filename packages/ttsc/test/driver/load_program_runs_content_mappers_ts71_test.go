//go:build ttsc_typescript_7_1

package driver_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramRunsContentMappersUnderRunExternalCode verifies that on the
// TypeScript 7.1 target a driver Program reads a content-mapped file through
// the project's content mapper when `--runExternalCode` is forwarded, keeps
// that mapper across a resident session's edit of the mapped file, and stops
// it on Close.
//
// The mapper is a real Node process speaking the compiler's mapper protocol,
// so the test crosses the same process boundary a project's mapper does.
//
//  1. Load the project with `--runExternalCode` and require the mapped module's
//     `query.name` to type-check.
//  2. Edit query.sql in a session and require the remapped column to replace
//     `name`, which index.ts then fails to read.
//  3. Close the session and require the mapper to have received closeProject.
//
// @evidence contracts/testing.md#behavioral-verification Calls LoadProgram and NewSession with forwarded `--runExternalCode`, requiring zero diagnostics and `name: string` in the mapped text, then TS2339 and `label: string` after Session.Apply of query.sql, then a closeProject request in the mapper's log after Close.
// @evidence contracts/testing.md#independent-expectations The mapper's output is a fixed function of the fixture's column name, so `name: string`, `label: string` and the TS2339 read of `name` follow from the fixture rather than from compiler output.
// @evidence contracts/testing.md#distinguishing-cases A host without the mapper project loads query.sql empty and fails step 1; a session host that drops the project fails the remap in step 2; a Close that keeps the mapper fails step 3.
// @evidence contracts/testing.md#execution-ownership The owning driver unit loads in-process Programs over a private temporary project and starts its own Node mapper; it closes every Program and Session it opens.
func TestLoadProgramRunsContentMappersUnderRunExternalCode(t *testing.T) {
  root := writeContentMapperProject(t)
  options := driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: []string{"--runExternalCode"}}

  program, diags, err := driver.LoadProgram(root, "tsconfig.json", options)
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  if diagnostics := program.Diagnostics(); driver.CountErrors(diagnostics) != 0 {
    t.Fatalf("the mapped module did not type-check: %#v", diagnostics)
  }
  if file := program.SourceFile(filepath.Join(root, "query.sql")); file == nil || !strings.Contains(file.Text(), "name: string") {
    t.Fatalf("query.sql was not mapped: %#v", file)
  }
  if err := program.Close(); err != nil {
    t.Fatal(err)
  }

  session, diags, err := driver.NewSession(root, "tsconfig.json", options)
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected session diagnostics: %#v", diags)
  }
  session.Apply(filepath.Join(root, "query.sql"), "label\n")
  text, ok := session.SourceText(filepath.Join(root, "query.sql"))
  if !ok || !strings.Contains(text, "label: string") {
    t.Fatalf("the edited query.sql was not remapped: %q", text)
  }
  missing := false
  for _, diagnostic := range session.Program().Diagnostics() {
    if diagnostic.Code == 2339 {
      missing = true
    }
  }
  if !missing {
    t.Fatalf("index.ts still reads query.name after the column became label: %#v", session.Program().Diagnostics())
  }
  if err := session.Close(); err != nil {
    t.Fatal(err)
  }

  log, err := os.ReadFile(filepath.Join(root, "node_modules", "sql-mapper", "mapper.log"))
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(string(log), "closeProject") {
    t.Fatalf("Close did not close the mapper project:\n%s", log)
  }
}
