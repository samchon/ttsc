package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestRunReportsAnUnloadableProjectWithoutPrintingADump verifies that a project
// the command cannot load exits non-zero, prints nothing to stdout, and names
// what it could not load.
//
// A missing config must return status 1 without a JSON dump, leaving the failure
// description on stderr. This case observes that one load-failure path, not every
// command failure or an external viewer's process and JSON handling.
//
//  1. Run the command against a tsconfig that does not exist.
//  2. Assert it returns 1 and wrote nothing to stdout.
//  3. Assert stderr names the command and the path it could not load.
//
// @evidence contracts/testing.md#behavioral-verification Verifies that a project the command cannot load exits non-zero, prints nothing to stdout, and names what it could not load.
// @evidence contracts/testing.md#independent-expectations Literal status 1, empty stdout and stderr containing graphdump: and absent.json follow the command's missing-config failure policy and stdout-is-JSON rule. They are not computed from run; a successful status or partial dump on this path fails these assertions. Other load-failure paths and external process exit handling are outside this case.
// @evidence contracts/testing.md#distinguishing-cases Run the command against a tsconfig that does not exist; Assert it returns 1 and wrote nothing to stdout; Assert stderr names the command and the path it could not load.
// @evidence contracts/testing.md#execution-ownership TestRunReportsAnUnloadableProjectWithoutPrintingADump is a Go source-unit entry. It calls run in-process against an empty temporary directory with a tsconfig name that does not exist, so driver.LoadProgram fails inside the test process; no consumer is installed and no binary is built or launched.
func TestRunReportsAnUnloadableProjectWithoutPrintingADump(t *testing.T) {
  root := t.TempDir()

  var out, errOut bytes.Buffer
  restoreStdout, restoreStderr := stdout, stderr
  stdout, stderr = &out, &errOut
  defer func() { stdout, stderr = restoreStdout, restoreStderr }()

  code := run([]string{"--cwd", root, "--tsconfig", "absent.json"})

  if code != 1 {
    t.Fatalf("graphdump exited %d for an unloadable project, want 1", code)
  }
  if out.Len() != 0 {
    t.Fatalf("a failed run wrote %q to stdout; the viewer pipeline parses that stream as JSON", out.String())
  }
  if !strings.Contains(errOut.String(), "graphdump:") {
    t.Fatalf("stderr does not identify the command: %q", errOut.String())
  }
  if !strings.Contains(errOut.String(), "absent.json") {
    t.Fatalf("stderr does not name the tsconfig it could not load: %q", errOut.String())
  }
}
