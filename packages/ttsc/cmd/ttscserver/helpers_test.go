package main

import (
  "io"
  "testing"
)

// withIO swaps the package-level stdin/stdout/stderr around fn and
// restores them on exit. Internal cmd tests use it to capture writer
// output without touching os.Stdout/os.Stderr.
func withIO(t *testing.T, out io.Writer, err io.Writer, in io.Reader, fn func()) {
  t.Helper()
  prevOut, prevErr, prevIn := stdout, stderr, stdin
  defer func() {
    stdout, stderr, stdin = prevOut, prevErr, prevIn
  }()
  if out != nil {
    stdout = out
  }
  if err != nil {
    stderr = err
  }
  if in != nil {
    stdin = in
  }
  fn()
}
