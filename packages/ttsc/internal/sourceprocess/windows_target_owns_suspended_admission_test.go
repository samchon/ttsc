//go:build windows

package sourceprocess

import (
  "fmt"
  "os"
  "path/filepath"
  "strconv"
  "testing"

  "golang.org/x/sys/windows"
)

// TestWindowsTargetOwnsSuspendedAdmission checks original-handle admission
// before any target code runs, then distinguishes resume from retirement.
// The authored helper only publishes its PID and exits; it creates no children.
//
// 1. Create this test executable suspended with a caller-private marker.
// 2. Verify original process/thread identity, no marker and a pending process.
// 3. Resume once and join exit seven through the original process handle.
// 4. Create another suspended helper, retire it without RUN and require no marker.
//
// @evidence contracts/testing.md#behavioral-verification The owning Windows target abstraction creates actual suspended native commands. ResumeThread's count and original-handle waits verify execution admission, selected PID publication, exit status and retirement without execution.
// @evidence contracts/testing.md#independent-expectations The authored helper publishes its actual os.Getpid and exits seven. A suspended primary thread cannot publish the marker; retirement before resumption cannot execute the helper body.
// @evidence contracts/testing.md#distinguishing-cases Resumed completion contrasts with termination before RUN, with exact positive PID identity, nonzero exit status and absence of pre-admission effects. Product descendant ownership and SDK buffer cancellation remain separate installed-protocol E2E coverage.
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
      defer func() {
        _ = windows.TerminateProcess(owner.info.Process, 1)
        _, _ = windows.WaitForSingleObject(owner.info.Process, windows.INFINITE)
        if err := owner.close(); err != nil {
          t.Error(err)
        }
      }()
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
      } else if err := windows.TerminateProcess(owner.info.Process, 1); err != nil {
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
