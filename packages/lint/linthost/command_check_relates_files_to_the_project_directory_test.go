package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckRelatesFilesToTheProjectDirectory verifies a rule that
// relates a file to the project directory reads the directory the Program was
// opened in, not the process's working directory.
//
// The check command opens the Program at --cwd and supplies that directory to
// the engine. This fixture places the project in a temporary directory distinct
// from the process directory, so using the latter would lose the project's
// Bad_Dir segment. It does not exercise links or compare operating systems.
//
//  1. Create a project whose source sits in `src/Bad_Dir/`.
//  2. Run the check command with `--cwd` at the project and
//     `unicorn/filename-case`, whose directory check needs the file's path
//     relative to the project.
//  3. Assert the directory `Bad_Dir` is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual check on an explicit cwd project reports authored Bad_Dir through unicorn/filename-case, even though the test process operates elsewhere.
// @evidence contracts/testing.md#independent-expectations The independently authored directory violates the configured directory naming policy and requires status two plus its literal diagnostic, without computing expectations from project-path resolution.
// @evidence contracts/testing.md#distinguishing-cases Explicit project cwd differs from process cwd, isolating relative directory interpretation; a correctly named good-file source prevents the filename itself from substituting for the intended directory diagnostic.
// @evidence contracts/testing.md#execution-ownership Real Go command, JSON config resolution, in-process compiler and filename rule execute in a temporary project without a filesystem link, native producer, installed CLI or spawned compiler.
func TestCommandCheckRelatesFilesToTheProjectDirectory(t *testing.T) {
  root := seedLintProjectFile(t, "Bad_Dir/good-file.ts", "export const value = 1;\n")
  seedLintRules(t, root, map[string]string{"unicorn/filename-case": "error"})
  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || !strings.Contains(stderr, "Directory name `Bad_Dir`") {
    t.Fatalf("the project directory was not the one the Program opened: code=%d stderr=%q", code, stderr)
  }
}
