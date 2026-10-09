//go:build windows

package sourceprocess

import (
  "os"
  "testing"
  "unsafe"

  "golang.org/x/sys/windows"
)

// TestWindowsJobAccountingRejectsInvalidBoundary verifies that a native job
// reports its empty population while ambient and invalid handles cannot prove
// ownership of the command's boundary.
//
// 1. Create a real unnamed job and configure descendant retirement on closure.
// 2. Assign a real suspended target, distinguish its original wait from the populated job, then retire both.
// 3. Close the job and reject ambient/null and invalid handles as ownership proof.
//
// @evidence contracts/testing.md#behavioral-verification The test executes actual Job Object creation, assignment, limits, termination and windowsJobActive accounting. A retained original target wait and an empty owned boundary are independently required after retirement; null/ambient and invalid handles cannot prove containment.
// @evidence contracts/testing.md#independent-expectations A newly created job has no assigned processes, so the Windows job contract independently requires zero active members. The helper requires an explicitly acquired job; an ambient query would certify unrelated ownership even when Windows accepts a null handle.
// @evidence contracts/testing.md#distinguishing-cases Empty and populated jobs contrast with the separate pending and retired original target. Null/ambient and invalid handles are rejected ownership boundaries. Surviving descendants and SDK cancellation belong to the platform protocol E2E scenarios.
// @evidence contracts/testing.md#execution-ownership This Go package unit calls its owning native accounting and suspended-creation operations without building an artifact, installing a consumer or launching a product host. Its own test executable is terminated without ever running target code; original process, thread, input and job handles are closed.
func TestWindowsJobAccountingRejectsInvalidBoundary(t *testing.T) {
  job, err := windows.CreateJobObject(nil, nil)
  if err != nil {
    t.Fatal(err)
  }
  closed := false
  defer func() {
    if !closed {
      _ = windows.CloseHandle(job)
    }
  }()
  limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
  limits.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
  if _, err = windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&limits)), uint32(unsafe.Sizeof(limits))); err != nil {
    t.Fatal(err)
  }
  if err = windows.TerminateJobObject(job, 1); err != nil {
    t.Fatal(err)
  }
  active, err := windowsJobActive(job)
  if err != nil || active != 0 {
    t.Fatalf("empty job active=%d error=%v", active, err)
  }
  executable, err := os.Executable()
  if err != nil {
    t.Fatal(err)
  }
  input, err := os.Open(os.DevNull)
  if err != nil {
    t.Fatal(err)
  }
  defer input.Close()
  owner, err := startWindowsTarget(request{Version: 1, Command: executable, Cwd: t.TempDir(), Env: map[string]string{"SystemRoot": os.Getenv("SystemRoot")}}, input)
  if err != nil {
    t.Fatal(err)
  }
  defer func() {
    if err := windows.TerminateProcess(owner.info.Process, 1); err == nil {
      _ = waitWindowsTarget(owner.info.Process, windows.INFINITE)
    }
    _ = owner.close()
  }()
  if err := windows.AssignProcessToJobObject(job, owner.info.Process); err != nil {
    t.Fatal(err)
  }
  active, err = windowsJobActive(job)
  if err != nil || active != 1 {
    t.Fatalf("populated job active=%d error=%v", active, err)
  }
  if err := waitWindowsTarget(owner.info.Process, 0); err == nil {
    t.Fatal("populated suspended target reported retired")
  }
  if err := windows.TerminateJobObject(job, 1); err != nil {
    t.Fatal(err)
  }
  if err := waitWindowsTarget(owner.info.Process, windows.INFINITE); err != nil {
    t.Fatal(err)
  }
  active, err = windowsJobActive(job)
  if err != nil || active != 0 {
    t.Fatalf("retired job active=%d error=%v", active, err)
  }
  if err = windows.CloseHandle(job); err != nil {
    t.Fatal(err)
  }
  closed = true
  if _, err = windowsJobActive(0); err == nil {
    t.Fatal("null job handle certified an empty boundary")
  }
  if _, err = windowsJobActive(windows.InvalidHandle); err == nil {
    t.Fatal("invalid job handle certified an empty boundary")
  }
}
