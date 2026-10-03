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
// The package-controlled streams and ContinueOnError parser let the caller
// observe rejection without terminating the test process. Help is distinguished
// from an unknown flag even though both paths return a parser error.
//
//  1. Run the command with an unknown flag, capturing both streams.
//  2. Assert it returns 2 rather than exiting, and that nothing reached stdout.
//  3. Assert the usage text went to the command's stderr stream.
//  4. Assert `-h` still succeeds, because asking for usage is not an error.
//
// @evidence contracts/testing.md#behavioral-verification Verifies that a bad argument returns an exit code and writes usage to the command's own stream, instead of terminating the process.
// @evidence contracts/testing.md#independent-expectations Literal status 2 for an unknown flag follows the command's rejection policy; status 0 for -h follows its successful-help policy around flag.ErrHelp. Unknown-flag stderr must name the rejected flag and show -tsconfig usage, with empty stdout. Help must show usage and return 0; this case does not separately assert help stdout. These expectations are not computed from run.
// @evidence contracts/testing.md#distinguishing-cases Run the command with an unknown flag, capturing both streams; Assert it returns 2 rather than exiting, and that nothing reached stdout; Assert the usage text went to the command's stderr stream. 4. Assert `-h` still succeeds, because asking for usage is not an error.
// @evidence contracts/testing.md#execution-ownership TestRunReportsAnUnknownFlagWithoutExitingTheProcess is a Go source-unit entry. It calls the package's run function in-process with stdout and stderr swapped for buffers; both argument paths return before any project is loaded, so no consumer is installed and no binary is built or launched.
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

  // ContinueOnError reports -h as ErrHelp; mapping every parse error to status 2
  // would turn this successful usage request into a failed invocation.
  out.Reset()
  errOut.Reset()
  if code := run([]string{"-h"}); code != 0 {
    t.Fatalf("graphdump exited %d for -h, want 0", code)
  }
  if !strings.Contains(errOut.String(), "-tsconfig") {
    t.Fatalf("-h printed no usage text: %q", errOut.String())
  }
}
