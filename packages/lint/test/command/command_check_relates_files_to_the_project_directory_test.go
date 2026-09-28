package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckRelatesFilesToTheProjectDirectory verifies a rule that
// relates a file to the project directory reads the directory the Program was
// opened in, not the process's working directory.
//
// The check command opens the Program at `--cwd`, and the engine took its
// project directory from `os.Getwd` instead. The launcher starts the host in
// the project directory, but Go's `os.Getwd` returns the shell's `PWD` whenever
// that names the same directory. A project reached through a link, or macOS's
// `/var`, therefore gave the rules a logical spelling while the Program named
// its files by the physical one, and a project file read as outside the
// project. This case runs the command from another directory, which separates
// the two the same way on every platform.
//
//  1. Create a project whose source sits in `src/Bad_Dir/`.
//  2. Run the check command with `--cwd` at the project and
//     `unicorn/filename-case`, whose directory check needs the file's path
//     relative to the project.
//  3. Assert the directory `Bad_Dir` is reported.
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
