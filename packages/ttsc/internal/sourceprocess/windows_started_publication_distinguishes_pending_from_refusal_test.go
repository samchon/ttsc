//go:build windows

package sourceprocess

import (
  "errors"
  "os"
  "path/filepath"
  "testing"

  "golang.org/x/sys/windows"
)

// TestWindowsStartedPublicationDistinguishesPendingFromRefusal verifies native
// publication acquisition without treating its readable bytes as enrollment.
//
// 1. Keep missing input pending, then lock a real complete receipt exclusively.
// 2. Require an actual sharing violation to remain pending and recover on close.
// 3. Refuse malformed bytes and a native directory read, then recover a repair.
//
// @evidence contracts/testing.md#behavioral-verification Actual Windows CreateFile with no sharing makes the maintained receipt reader fail with ERROR_SHARING_VIOLATION; releasing that handle yields the literal decoded record. Missing input stays pending, while malformed JSON and a real directory read refuse without pending authority. Repair is observed without historical success or failure caching.
// @evidence contracts/testing.md#independent-expectations Authored schema-one bytes declare PID 7 and creation 42 solely as decoding inputs; Windows' exclusive sharing contract supplies the expected native error. These literals do not certify a real process, which remains retainWindowsTarget's separate admission responsibility.
// @evidence contracts/testing.md#distinguishing-cases Missing and temporarily unreadable complete publications contrast with readable valid bytes, corrupt JSON and other native I/O refusal. Real release and repair distinguish acquisition recovery from a cached verdict. TestWindowsTargetOwnsSuspendedAdmission separately rejects foreign/missing PID, creation and Job identity; ordinary owned-process E2E covers actual RPC cancellation and cleanup.
// @evidence contracts/testing.md#execution-ownership This Windows package unit directly calls its owning reader with t.TempDir files and one real exclusive native handle, closed on every path before directory cleanup. It builds or starts no compiler, plugin, product host or consumer and does not replace filesystem/process methods.
func TestWindowsStartedPublicationDistinguishesPendingFromRefusal(t *testing.T) {
  directory := t.TempDir()
  file := filepath.Join(directory, "started.json")
  if target, pending, err := readWindowsStarted(file); !pending || !os.IsNotExist(err) || target != (windowsStarted{}) {
    t.Fatalf("missing publication: target=%+v pending=%t error=%v", target, pending, err)
  }
  data := []byte(`{"version":1,"pid":7,"created":42}`)
  if err := os.WriteFile(file, data, 0600); err != nil {
    t.Fatal(err)
  }
  name, err := windows.UTF16PtrFromString(file)
  if err != nil {
    t.Fatal(err)
  }
  handle, err := windows.CreateFile(name, windows.GENERIC_READ, 0, nil, windows.OPEN_EXISTING, windows.FILE_ATTRIBUTE_NORMAL, 0)
  if err != nil {
    t.Fatal(err)
  }
  defer func() {
    if handle != 0 {
      if err := windows.CloseHandle(handle); err != nil {
        t.Error(err)
      }
    }
  }()
  if target, pending, err := readWindowsStarted(file); !pending || !errors.Is(err, windows.ERROR_SHARING_VIOLATION) || target != (windowsStarted{}) {
    t.Fatalf("locked publication: target=%+v pending=%t error=%v", target, pending, err)
  }
  if err := windows.CloseHandle(handle); err != nil {
    t.Fatal(err)
  }
  handle = 0
  expected := windowsStarted{Version: 1, Pid: 7, Created: 42}
  if target, pending, err := readWindowsStarted(file); err != nil || pending || target != expected {
    t.Fatalf("released publication: target=%+v pending=%t error=%v", target, pending, err)
  }
  if err := os.WriteFile(file, []byte(`{"version":1`), 0600); err != nil {
    t.Fatal(err)
  }
  if target, pending, err := readWindowsStarted(file); err == nil || pending || target != (windowsStarted{}) {
    t.Fatalf("malformed publication: target=%+v pending=%t error=%v", target, pending, err)
  }
  if _, pending, err := readWindowsStarted(directory); err == nil || pending {
    t.Fatalf("directory refusal: pending=%t error=%v", pending, err)
  }
  if err := os.WriteFile(file, data, 0600); err != nil {
    t.Fatal(err)
  }
  if target, pending, err := readWindowsStarted(file); err != nil || pending || target != expected {
    t.Fatalf("repaired publication: target=%+v pending=%t error=%v", target, pending, err)
  }
}
