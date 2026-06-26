package main

import (
  "bytes"
  "errors"
  "strings"
  "testing"
)

// TestRunHelpVersionAndBadFlagsExitCodes verifies the top-level run dispatcher
// returns the documented exit codes for the dump-only command surface: help and
// version short-circuit to 0, an unknown command prints usage and exits 2, and a
// dump that cannot resolve its working directory exits 2 with an explanation.
//
// These are the non-load paths a user hits with a typo or `--help`; each must
// resolve to a code without building a Program. The getwd seam stands in for an
// unreadable working directory so the resolve-failure branch is reachable
// without a real filesystem fault.
//
//  1. run --help and run --version exit 0, printing the command name / version.
//  2. run --bogus (unknown command) exits 2 and prints usage.
//  3. run dump --nope exits 2 (dump flag parse failure).
//  4. With getwd forced to fail, run dump exits 2 and explains why.
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

  // An unknown command is an invalid invocation: print usage and exit 2.
  var badErr bytes.Buffer
  stderr = &badErr
  if code := run([]string{"--bogus"}); code != 2 {
    t.Fatalf("run --bogus exit = %d, want 2", code)
  }
  if !strings.Contains(badErr.String(), "Usage:") {
    t.Fatalf("run --bogus exited 2 but did not print usage:\n%s", badErr.String())
  }

  // An unknown dump flag is an invalid invocation: dump's flag.Parse fails -> 2.
  var dumpFlagErr bytes.Buffer
  stderr = &dumpFlagErr
  if code := run([]string{"dump", "--nope"}); code != 2 {
    t.Fatalf("run dump --nope exit = %d, want 2", code)
  }

  // A getwd failure (no --cwd given) is an invalid invocation -> 2, explained.
  var wdErr bytes.Buffer
  stderr = &wdErr
  getwd = func() (string, error) { return "", errors.New("boom") }
  if code := run([]string{"dump"}); code != 2 {
    t.Fatalf("run dump with getwd failure exit = %d, want 2", code)
  }
  if !strings.Contains(wdErr.String(), "could not resolve working directory") {
    t.Fatalf("getwd failure did not explain itself:\n%s", wdErr.String())
  }
}
