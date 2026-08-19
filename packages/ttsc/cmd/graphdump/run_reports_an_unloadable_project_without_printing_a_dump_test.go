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
// The benchmark viewer pipeline runs this command through `execFileSync`, which
// raises only on a non-zero exit and otherwise parses stdout as JSON. Every
// failure path here therefore has to be a non-zero exit: turning one into 0
// hands the pipeline an empty string, and the caller dies inside its JSON parse
// with an opaque error instead of reading the diagnostic this command already
// wrote. All three failure paths used to be unpinned, so replacing every
// `return 1` with `return 0` broke no test.
//
//  1. Run the command against a tsconfig that does not exist.
//  2. Assert it returns 1 and wrote nothing to stdout.
//  3. Assert stderr names the command and the path it could not load.
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
