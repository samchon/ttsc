package main

import (
  "bytes"
  "errors"
  "strings"
  "testing"
)

// TestRunHelpVersionAndBadFlagsExitCodes verifies the top-level run dispatcher
// returns the documented exit codes for its four flag shapes, exercising the
// real run entrypoint so the help/version short-circuits and the runServe flag
// and getwd error branches all stay covered.
//
// These are the non-load paths a user hits with a typo or a `--help`: each must
// resolve to a code (0/0/2/2) without ever building a Program. The getwd seam
// stands in for an unreadable working directory so the resolve-failure branch is
// reachable without a real filesystem fault.
//
//  1. run --help and run --version exit 0, printing the command name / a version.
//  2. run --bogus exits 2 (flag parse failure in runServe).
//  3. With getwd forced to fail, run with no args exits 2 and explains why.
func TestRunHelpVersionAndBadFlagsExitCodes(t *testing.T) {
  oldStdout, oldStderr, oldGetwd := stdout, stderr, getwd
  defer func() { stdout, stderr, getwd = oldStdout, oldStderr, oldGetwd }()

  // --help exits 0 and names the command on stdout.
  var helpOut bytes.Buffer
  stdout = &helpOut
  if code := run([]string{"--help"}); code != 0 {
    t.Fatalf("run --help exit = %d, want 0", code)
  }
  if !strings.Contains(helpOut.String(), "ttscgraph") {
    t.Fatalf("run --help did not print the command name:\n%s", helpOut.String())
  }

  // --version exits 0 and prints a version-ish string.
  var versionOut bytes.Buffer
  stdout = &versionOut
  if code := run([]string{"--version"}); code != 0 {
    t.Fatalf("run --version exit = %d, want 0", code)
  }
  if got := versionOut.String(); !strings.Contains(got, "ttscgraph") || !strings.Contains(got, version) {
    t.Fatalf("run --version did not print a version string:\n%s", got)
  }

  // An unknown flag is an invalid invocation: runServe's flag.Parse fails -> 2.
  var badErr bytes.Buffer
  stderr = &badErr
  if code := run([]string{"--bogus"}); code != 2 {
    t.Fatalf("run --bogus exit = %d, want 2", code)
  }
  if !strings.Contains(badErr.String(), "not defined") {
    t.Fatalf("run --bogus exited 2 but did not report the undefined flag:\n%s", badErr.String())
  }

  // A getwd failure (no --cwd given) is an invalid invocation -> 2, explained.
  var wdErr bytes.Buffer
  stderr = &wdErr
  getwd = func() (string, error) { return "", errors.New("boom") }
  if code := run([]string{}); code != 2 {
    t.Fatalf("run with getwd failure exit = %d, want 2", code)
  }
  if !strings.Contains(wdErr.String(), "could not resolve working directory") {
    t.Fatalf("getwd failure did not explain itself:\n%s", wdErr.String())
  }
}
