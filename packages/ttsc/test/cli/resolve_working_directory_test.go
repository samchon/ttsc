package ttsc_test

import (
  "errors"
  "strings"
  "testing"

  cwdutil "github.com/samchon/ttsc/packages/ttsc/internal/cwd"
)

// TestCLIResolveWorkingDirectory verifies cwd resolution branches.
//
// API commands need the same current-directory contract whether callers pass
// --cwd explicitly or rely on the process directory. The resolver keeps the OS
// dependency injectable so the failure path stays covered from the package test
// tree.
//
// 1. Resolve an explicit override without calling the host getwd function.
// 2. Resolve an empty override through a successful getwd function.
// 3. Assert getwd failures return a diagnostic error instead of a directory.
func TestCLIResolveWorkingDirectory(t *testing.T) {
  called := false
  wd, err := cwdutil.Resolve("/project", func() (string, error) {
    called = true
    return "", nil
  })
  if err != nil || wd != "/project" || called {
    t.Fatalf("override resolution mismatch: wd=%q called=%v err=%v", wd, called, err)
  }

  wd, err = cwdutil.Resolve("", func() (string, error) {
    return "/current", nil
  })
  if err != nil || wd != "/current" {
    t.Fatalf("getwd resolution mismatch: wd=%q err=%v", wd, err)
  }

  wd, err = cwdutil.Resolve("", func() (string, error) {
    return "", errors.New("missing cwd")
  })
  if err == nil || wd != "" || !strings.Contains(err.Error(), "missing cwd") {
    t.Fatalf("getwd failure mismatch: wd=%q err=%v", wd, err)
  }
}
