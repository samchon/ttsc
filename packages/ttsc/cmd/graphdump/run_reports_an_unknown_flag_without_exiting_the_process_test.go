package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestRunReportsAnUnknownFlagWithoutExitingTheProcess verifies that a bad
// argument returns an exit code and writes usage to the command's own stream,
// instead of terminating the process.
//
// This is the negative twin of the capability case and the reason the seams
// exist. The command used to parse flag.CommandLine, whose default error
// handling is flag.ExitOnError: a malformed argument called os.Exit(2) from
// inside run, which no test can observe and which would take a test binary down
// with it. Nothing else about the command is reachable while that is true.
//
//  1. Run the command with an unknown flag, capturing both streams.
//  2. Assert it returns 2 rather than exiting, and that nothing reached stdout.
//  3. Assert the usage text went to the command's stderr stream.
//  4. Assert `-h` still succeeds, because asking for usage is not an error.
func TestRunReportsAnUnknownFlagWithoutExitingTheProcess(t *testing.T) {
  var out, errOut bytes.Buffer
  restoreStdout, restoreStderr := stdout, stderr
  stdout, stderr = &out, &errOut
  defer func() { stdout, stderr = restoreStdout, restoreStderr }()

  code := run([]string{"--not-a-flag"})

  if code != 2 {
    t.Fatalf("graphdump exited %d for an unknown flag, want 2", code)
  }
  if out.Len() != 0 {
    t.Fatalf("a rejected invocation wrote %q to stdout; the viewer pipeline parses that stream as JSON", out.String())
  }
  if !strings.Contains(errOut.String(), "not-a-flag") {
    t.Fatalf("stderr does not name the rejected flag: %q", errOut.String())
  }
  if !strings.Contains(errOut.String(), "-tsconfig") {
    t.Fatalf("stderr carried no usage text: %q", errOut.String())
  }

  // The negative twin of the rejection: `flag.ContinueOnError` reports `-h` as
  // an error too, and mapping every parse failure to 2 would turn the help flag
  // into a failed invocation. The global flag set this command used to read
  // exited 0 for it.
  out.Reset()
  errOut.Reset()
  if code := run([]string{"-h"}); code != 0 {
    t.Fatalf("graphdump exited %d for -h, want 0", code)
  }
  if !strings.Contains(errOut.String(), "-tsconfig") {
    t.Fatalf("-h printed no usage text: %q", errOut.String())
  }
}
