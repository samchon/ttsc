//go:build windows

package sourceprocess

import (
  "testing"
  "unsafe"

  "golang.org/x/sys/windows"
)

// TestWindowsJobAccountingRejectsInvalidBoundary verifies that a native job
// reports its empty population while ambient and invalid handles cannot prove
// ownership of the command's boundary.
//
// 1. Create a real unnamed job and configure descendant retirement on closure.
// 2. Terminate its empty population and assert the kernel reports zero members.
// 3. Close the job and reject ambient/null and invalid handles as ownership proof.
//
// @evidence contracts/testing.md#behavioral-verification The test executes actual Job Object creation, limits, termination and windowsJobActive accounting. It distinguishes a proven empty owned job from null/ambient and invalid handles that cannot prove this command's containment.
// @evidence contracts/testing.md#independent-expectations A newly created job has no assigned processes, so the Windows job contract independently requires zero active members. The helper requires an explicitly acquired job; an ambient query would certify unrelated ownership even when Windows accepts a null handle.
// @evidence contracts/testing.md#distinguishing-cases The live empty job is the positive boundary; null/ambient and invalid handles are rejected ownership boundaries. Actual target assignment, cancellation and surviving descendants belong to the installed platform protocol E2E scenarios.
// @evidence contracts/testing.md#execution-ownership This Go package unit directly calls its owning native accounting operation without building an artifact, installing a consumer or launching a product host. It owns and closes only the job created here.
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
