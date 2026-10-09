//go:build windows

package sourceprocess

import (
  "fmt"
  "os"
  "path/filepath"
  "strconv"
  "testing"
  "unsafe"

  "golang.org/x/sys/windows"
)

// TestWindowsTargetOwnsSuspendedAdmission checks original-handle admission
// before any target code runs, then distinguishes resume from retirement.
// The authored helper only publishes its PID and exits; it creates no children.
//
// 1. Create this test executable suspended with a caller-private marker.
// 2. Retain its exact creation in an owned job before RUN and reject foreign identities.
// 3. Resume once and join exit seven through the original process handle.
// 4. Create another suspended helper, retire it without RUN and require no marker.
//
// @evidence contracts/testing.md#behavioral-verification The owning Windows target abstraction creates actual suspended native commands. Actual job assignment and retainWindowsTarget validate PID, creation and membership before RUN; a separate retained handle remains usable after the creation handles close. ResumeThread and original-object waits preserve nonzero completion and retirement without execution.
// @evidence contracts/testing.md#independent-expectations The authored helper publishes its actual os.Getpid and exits seven. A suspended primary thread cannot publish the marker; retirement before resumption cannot execute the helper body.
// @evidence contracts/testing.md#distinguishing-cases Resumed completion contrasts with job termination before RUN. Missing/version/PID/creation identities, a different real job and invalid job handles refuse enrollment; invalid wait handles refuse completion. Pending suspended targets cannot certify retirement. Product descendant ownership, cancellation during the START publication window and SDK overflow remain separate installed-protocol E2E coverage.
// @evidence contracts/testing.md#execution-ownership This native package unit directly exercises its owning process primitive and launches only its own authored test helper, without building another artifact, installing a consumer or launching a compiler/product host. It joins each original process and closes every acquired native handle and input file.
func TestWindowsTargetOwnsSuspendedAdmission(t *testing.T) {
  if marker := os.Getenv("TTSC_SOURCEPROCESS_UNIT_MARKER"); marker != "" {
    if err := os.WriteFile(marker, []byte(strconv.Itoa(os.Getpid())), 0600); err != nil {
      os.Exit(8)
    }
    os.Exit(7)
  }
  executable, err := os.Executable()
  if err != nil {
    t.Fatal(err)
  }
  for _, resume := range []bool{true, false} {
    t.Run(fmt.Sprintf("resume-%t", resume), func(t *testing.T) {
      directory := t.TempDir()
      marker := filepath.Join(directory, "executed.pid")
      input, err := os.Open(os.DevNull)
      if err != nil {
        t.Fatal(err)
      }
      defer input.Close()
      owner, err := startWindowsTarget(request{Version: 1, Command: executable, Args: []string{"-test.run=^TestWindowsTargetOwnsSuspendedAdmission$"}, Cwd: directory, Env: map[string]string{"TTSC_SOURCEPROCESS_UNIT_MARKER": marker, "SystemRoot": os.Getenv("SystemRoot")}}, input)
      if err != nil {
        t.Fatal(err)
      }
      ownerClosed := false
      defer func() {
        if !ownerClosed {
          if err := windows.TerminateProcess(owner.info.Process, 1); err == nil {
            _ = waitWindowsTarget(owner.info.Process, windows.INFINITE)
          }
          if err := owner.close(); err != nil {
            t.Error(err)
          }
        }
      }()
      job, err := windows.CreateJobObject(nil, nil)
      if err != nil {
        t.Fatal(err)
      }
      defer windows.CloseHandle(job)
      limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
      limits.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
      if _, err := windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&limits)), uint32(unsafe.Sizeof(limits))); err != nil {
        t.Fatal(err)
      }
      if err := windows.AssignProcessToJobObject(job, owner.info.Process); err != nil {
        t.Fatal(err)
      }
      identity, err := owner.started()
      if err != nil {
        t.Fatal(err)
      }
      for name, invalid := range map[string]windowsStarted{
        "missing": {},
        "version": {Version: 2, Pid: identity.Pid, Created: identity.Created},
        "pid": {Version: 1, Created: identity.Created},
        "foreign-pid": {Version: 1, Pid: uint32(os.Getpid()), Created: identity.Created},
        "missing-creation": {Version: 1, Pid: identity.Pid},
        "creation": {Version: 1, Pid: identity.Pid, Created: identity.Created + 1},
      } {
        t.Run(name, func(t *testing.T) {
          handle, err := retainWindowsTarget(invalid, job)
          if err == nil || handle != 0 {
            t.Fatalf("foreign identity admitted handle=%v error=%v", handle, err)
          }
        })
      }
      foreignJob, err := windows.CreateJobObject(nil, nil)
      if err != nil {
        t.Fatal(err)
      }
      defer windows.CloseHandle(foreignJob)
      for _, boundary := range []windows.Handle{0, windows.InvalidHandle, foreignJob} {
        if handle, err := retainWindowsTarget(identity, boundary); err == nil || handle != 0 {
          t.Fatalf("foreign job admitted handle=%v error=%v", handle, err)
        }
      }
      retained, err := retainWindowsTarget(identity, job)
      if err != nil {
        t.Fatal(err)
      }
      defer windows.CloseHandle(retained)
      if err := waitWindowsTarget(retained, 0); err == nil {
        t.Fatal("suspended original target certified completion")
      }
      if err := waitWindowsTarget(windows.InvalidHandle, 0); err == nil {
        t.Fatal("invalid handle certified completion")
      }
      if err := windows.TerminateJobObject(windows.InvalidHandle, 1); err == nil {
        t.Fatal("invalid termination unexpectedly succeeded")
      }
      if err := waitWindowsTarget(retained, 0); err == nil {
        t.Fatal("failed termination certified a live target")
      }
      if owner.info.ProcessId == 0 || owner.info.ThreadId == 0 || owner.info.Process == 0 || owner.info.Thread == 0 {
        t.Fatal("creation did not preserve original process/thread identity")
      }
      pid, err := windows.GetProcessId(owner.info.Process)
      if err != nil || pid != owner.info.ProcessId {
        t.Fatalf("original process identity=%d error=%v", pid, err)
      }
      var created, exited, kernel, user windows.Filetime
      if err := windows.GetProcessTimes(owner.info.Process, &created, &exited, &kernel, &user); err != nil {
        t.Fatal(err)
      }
      if created.HighDateTime == 0 && created.LowDateTime == 0 {
        t.Fatal("original creation identity is absent")
      }
      state, err := windows.WaitForSingleObject(owner.info.Process, 0)
      if err != nil || state != uint32(windows.WAIT_TIMEOUT) {
        t.Fatalf("suspended process wait=%d error=%v", state, err)
      }
      if _, err := os.Stat(marker); !os.IsNotExist(err) {
        t.Fatalf("target executed before RUN: %v", err)
      }
      if resume {
        if err := owner.resume(); err != nil {
          t.Fatal(err)
        }
      } else if err := windows.TerminateJobObject(job, 1); err != nil {
        t.Fatal(err)
      }
      result := owner.wait()
      expected := 1
      if resume {
        expected = 7
      }
      if result.Error != nil || result.Status == nil || *result.Status != expected || result.Pid != int(pid) || !result.Cleanup.DirectChildJoined {
        t.Fatalf("original target completion: %#v", result)
      }
      if err := waitWindowsTarget(retained, windows.INFINITE); err != nil {
        t.Fatal(err)
      }
      if err := owner.close(); err != nil {
        t.Fatal(err)
      }
      ownerClosed = true
      if err := waitWindowsTarget(retained, 0); err != nil {
        t.Fatalf("retained original authority was lost with creation handles: %v", err)
      }
      if resume {
        data, err := os.ReadFile(marker)
        if err != nil || string(data) != strconv.Itoa(int(pid)) {
          t.Fatalf("actual target identity=%q error=%v", data, err)
        }
      } else if _, err := os.Stat(marker); !os.IsNotExist(err) {
        t.Fatalf("retired suspended target executed: %v", err)
      }
    })
  }
}
