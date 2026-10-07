package main

import (
  "bytes"
  "errors"
  "strings"
  "testing"
)

// TestRunHelpVersionAndBadFlagsExitCodes verifies the top-level run dispatcher
// returns the documented exit codes for the command surface: help and version
// short-circuit to 0, an unknown command prints usage and returns 2, and dump or
// serve flag failures return 2. Working-directory failures additionally require
// the literal explanatory phrase; bad-flag output is not asserted.
//
// These are the non-load paths a user hits with a typo or `--help`; each must
// resolve to a code without building a Program. The getwd seam stands in for an
// unreadable working directory so the resolve-failure branch is reachable
// without a real filesystem fault.
//
//  1. run --help and run --version exit 0, printing the command name / version.
//  2. run --bogus (unknown command) exits 2 and prints usage.
//  3. run dump --nope and run serve --nope exit 2 (flag parse failure).
//  4. With getwd forced to fail, run dump and run serve exit 2 and explain why.
//
// @evidence contracts/testing.md#behavioral-verification Calls the actual top-level dispatcher in-process. Help and version require status zero and their named text, unknown command requires status two and Usage:, dump/serve bad flags require status two only, and both failing cwd branches require status two plus could not resolve working directory. These are returned statuses, not OS exit transport assertions.
// @evidence contracts/testing.md#independent-expectations The expected exit codes (0 for help and version, 2 for an unknown command, a bad dump or serve flag, and a failed working-directory lookup) and message fragments (ttscgraph, Usage:, could not resolve working directory) are literals from the documented command surface, written independently of run. The version check compares with the package's own version variable, so it only proves the version string is printed.
// @evidence contracts/testing.md#distinguishing-cases run --help and run --version exit 0, printing the command name / version; run --bogus (unknown command) exits 2 and prints usage; run dump --nope and run serve --nope exit 2 (flag parse failure). 4. With getwd forced to fail, run dump and run serve exit 2 and explain why.
// @evidence contracts/testing.md#execution-ownership TestRunHelpVersionAndBadFlagsExitCodes is a Go source-unit entry. It calls the package's top-level run dispatcher in-process with stdout, stderr and the getwd seam replaced; every case returns before a Program is loaded or a serve session starts, so nothing is installed, built or launched.
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

  // An unknown serve flag is an invalid invocation: serve's flag.Parse fails -> 2.
  var serveFlagErr bytes.Buffer
  stderr = &serveFlagErr
  if code := run([]string{"serve", "--nope"}); code != 2 {
    t.Fatalf("run serve --nope exit = %d, want 2", code)
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

  // serve resolves the working directory the same way before touching stdin.
  var serveWdErr bytes.Buffer
  stderr = &serveWdErr
  if code := run([]string{"serve"}); code != 2 {
    t.Fatalf("run serve with getwd failure exit = %d, want 2", code)
  }
  if !strings.Contains(serveWdErr.String(), "could not resolve working directory") {
    t.Fatalf("serve getwd failure did not explain itself:\n%s", serveWdErr.String())
  }
}
