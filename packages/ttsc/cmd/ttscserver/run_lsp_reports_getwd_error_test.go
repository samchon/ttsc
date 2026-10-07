package main

import (
  "bytes"
  "errors"
  "strings"
  "testing"
)

// TestRunLSPReportsGetwdError pins the defensive Getwd error path. The
// host runs with an inherited working directory; if Getwd fails (e.g.
// the directory was removed mid-session) the launcher must surface a
// clean message and exit 2 instead of panicking inside tsgo.
//
// 1. Substitute the getwd seam to return an error.
// 2. Run runLSP with --stdio (no explicit --cwd).
// 3. Assert exit 2 and a stderr message mentioning the working directory.
//
// @evidence contracts/testing.md#behavioral-verification runLSP without --cwd exits with status 2 and a 'could not resolve working directory' message when the working directory cannot be read.
// @evidence contracts/testing.md#independent-expectations Status 2 and the message fragment are literals from the command contract; the failure is injected through the getwd seam.
// @evidence contracts/testing.md#distinguishing-cases The explicit --cwd path avoids Getwd and is covered by sibling tests; this case is the implicit one.
// @evidence contracts/testing.md#execution-ownership TestRunLSPReportsGetwdError is a Go unit test in the cmd/ttscserver package: it calls runLSP in-process with the runLSPServer or getwd seam replaced and captured streams, starting neither tsgo nor a product process.
func TestRunLSPReportsGetwdError(t *testing.T) {
  prev := getwd
  getwd = func() (string, error) { return "", errors.New("synthetic getwd failure") }
  defer func() { getwd = prev }()

  outBuf := &bytes.Buffer{}
  errBuf := &bytes.Buffer{}
  withIO(t, outBuf, errBuf, nil, func() {
    if code := runLSP([]string{"--stdio"}); code != 2 {
      t.Fatalf("expected exit 2, got %d", code)
    }
  })

  if !strings.Contains(errBuf.String(), "could not resolve working directory") {
    t.Fatalf("expected getwd error message, got: %q", errBuf.String())
  }
}
