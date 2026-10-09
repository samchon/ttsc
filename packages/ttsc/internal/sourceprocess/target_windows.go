//go:build windows

package sourceprocess

import (
  "errors"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "unsafe"

  "golang.org/x/sys/windows"
)

// windowsTarget retains the original process and primary-thread handles from
// suspended creation. The outer owner receives its PID before RUN permits any
// target code or output, and native waiting never substitutes a reused PID.
// Only duplicated standard handles are inherited; no broker, shell or global
// process/thread enumeration participates in execution.
//
// CreateProcess returns both original handles atomically. CREATE_SUSPENDED
// places PID publication before execution; ResumeThread uses the original
// primary-thread handle and requires exactly one suspended count. The outer
// Job owns cancellation and retires suspended or running targets after any
// handshake failure.
//
// The owner preserves the selected executable, argv0, verbatim argument policy,
// UTF-16 environment and cwd. Encoding is linear in command and environment
// bytes. Three duplicated descriptors and one attribute list have fixed size
// and are released after creation on every path. Each invocation owns its
// command effects and identity independently. The inner retains the original
// process/thread handles until target wait and result publication or inner exit.
type windowsTarget struct{ info windows.ProcessInformation }

// windowsStarted binds admission to the original suspended process. The inner
// holds its creation handles until RUN or helper exit; the outer acquires and
// validates its own non-inheritable wait handle before authorizing execution.
type windowsStarted struct {
  Version int    `json:"version"`
  Pid     uint32 `json:"pid"`
  Created uint64 `json:"created"`
}

func (owner *windowsTarget) started() (windowsStarted, error) {
  created, err := windowsProcessCreation(owner.info.Process)
  return windowsStarted{Version: 1, Pid: owner.info.ProcessId, Created: created}, err
}

// retainWindowsTarget runs while the inner still holds the suspended original.
// PID is only an enrollment coordinate: creation and job membership must match,
// and subsequent retirement waits use this retained object without a lookup.
// Failure closes the newly acquired handle and never authorizes RUN.
func retainWindowsTarget(started windowsStarted, job windows.Handle) (windows.Handle, error) {
  if started.Version != 1 || started.Pid == 0 || started.Created == 0 || job == 0 || job == windows.InvalidHandle {
    return 0, fmt.Errorf("invalid suspended target identity or job")
  }
  handle, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, started.Pid)
  if err != nil {
    return 0, err
  }
  pid, identityErr := windows.GetProcessId(handle)
  created, creationErr := windowsProcessCreation(handle)
  var member int32
  isProcessInJob := windows.NewLazySystemDLL("kernel32.dll").NewProc("IsProcessInJob")
  ok, _, membershipErr := isProcessInJob.Call(uintptr(handle), uintptr(job), uintptr(unsafe.Pointer(&member)))
  if identityErr != nil || creationErr != nil || pid != started.Pid || created != started.Created || ok == 0 || member == 0 {
    err = errors.Join(identityErr, creationErr)
    if ok == 0 {
      err = errors.Join(err, membershipErr)
    }
    return 0, errors.Join(fmt.Errorf("suspended target identity or job membership differs: %v", err), windows.CloseHandle(handle))
  }
  return handle, nil
}

func windowsProcessCreation(handle windows.Handle) (uint64, error) {
  var created, exited, kernel, user windows.Filetime
  err := windows.GetProcessTimes(handle, &created, &exited, &kernel, &user)
  return uint64(created.HighDateTime)<<32 | uint64(created.LowDateTime), err
}

// waitWindowsTarget distinguishes completed original-object waiting from job
// accounting. Callers use INFINITE only after successful owned termination or
// normal original completion; failed termination must not hang on a live target.
func waitWindowsTarget(handle windows.Handle, milliseconds uint32) error {
  state, err := windows.WaitForSingleObject(handle, milliseconds)
  if err != nil {
    return err
  }
  if state != windows.WAIT_OBJECT_0 {
    return fmt.Errorf("unexpected native target wait state %d", state)
  }
  return nil
}

func startWindowsTarget(req request, input *os.File) (*windowsTarget, error) {
  selected := exec.Command(req.Command, req.Args...)
  if selected.Err != nil {
    return nil, selected.Err
  }
  selected.Env = environment(req.Env)
  argv := append([]string{req.Command}, req.Args...)
  if req.Argv0 != nil {
    argv[0] = *req.Argv0
  }
  // The inner already runs in req.Cwd, matching exec.Cmd's relative executable
  // authority before CreateProcess performs its own child-directory change.
  executable, err := filepath.Abs(selected.Path)
  if err != nil {
    return nil, err
  }
  application, err := windows.UTF16PtrFromString(executable)
  if err != nil {
    return nil, err
  }
  encodedArgs := make([]string, len(argv))
  for i, arg := range argv {
    encodedArgs[i] = windows.EscapeArg(arg)
  }
  if req.WindowsVerbatimArguments {
    copy(encodedArgs[1:], req.Args)
  }
  commandLine, err := windows.UTF16PtrFromString(strings.Join(encodedArgs, " "))
  if err != nil {
    return nil, err
  }
  cwd, err := windows.UTF16PtrFromString(req.Cwd)
  if err != nil {
    return nil, err
  }
  var environmentBlock []uint16
  for _, entry := range selected.Environ() {
    encoded, err := windows.UTF16FromString(entry)
    if err != nil {
      return nil, err
    }
    environmentBlock = append(environmentBlock, encoded...)
  }
  environmentBlock = append(environmentBlock, 0)
  if len(environmentBlock) == 1 {
    environmentBlock = append(environmentBlock, 0)
  }
  handles := make([]windows.Handle, 3)
  defer func() {
    for _, handle := range handles {
      if handle != 0 {
        _ = windows.CloseHandle(handle)
      }
    }
  }()
  for i, file := range []*os.File{input, os.Stdout, os.Stderr} {
    if err := windows.DuplicateHandle(windows.CurrentProcess(), windows.Handle(file.Fd()), windows.CurrentProcess(), &handles[i], 0, true, windows.DUPLICATE_SAME_ACCESS); err != nil {
      return nil, err
    }
  }
  attributes, err := windows.NewProcThreadAttributeList(1)
  if err != nil {
    return nil, err
  }
  defer attributes.Delete()
  if err = attributes.Update(windows.PROC_THREAD_ATTRIBUTE_HANDLE_LIST, unsafe.Pointer(&handles[0]), uintptr(len(handles))*unsafe.Sizeof(handles[0])); err != nil {
    return nil, err
  }
  startup := windows.StartupInfoEx{ProcThreadAttributeList: attributes.List()}
  startup.Cb = uint32(unsafe.Sizeof(startup))
  startup.Flags = windows.STARTF_USESTDHANDLES
  startup.StdInput, startup.StdOutput, startup.StdErr = handles[0], handles[1], handles[2]
  owner := &windowsTarget{}
  err = windows.CreateProcess(application, commandLine, nil, nil, true, windows.CREATE_SUSPENDED|windows.CREATE_UNICODE_ENVIRONMENT|windows.EXTENDED_STARTUPINFO_PRESENT, &environmentBlock[0], cwd, &startup.StartupInfo, &owner.info)
  runtime.KeepAlive(handles)
  runtime.KeepAlive(environmentBlock)
  if err != nil {
    return nil, err
  }
  return owner, nil
}

func (owner *windowsTarget) resume() error {
  count, err := windows.ResumeThread(owner.info.Thread)
  if err != nil {
    return err
  }
  if count != 1 {
    return fmt.Errorf("source target primary thread had unexpected suspend count %d", count)
  }
  return nil
}

func (owner *windowsTarget) wait() result {
  value := result{Version: 1, Pid: int(owner.info.ProcessId)}
  if err := waitWindowsTarget(owner.info.Process, windows.INFINITE); err != nil {
    value.Error = &processError{Code: "EPROCESS", Message: err.Error()}
    return value
  }
  value.Cleanup.DirectChildJoined = true
  var code uint32
  if err := windows.GetExitCodeProcess(owner.info.Process, &code); err != nil {
    value.Error = &processError{Code: "EPROCESS", Message: err.Error()}
    return value
  }
  status := int(code)
  value.Status = &status
  return value
}

func (owner *windowsTarget) close() error {
  return errors.Join(windows.CloseHandle(owner.info.Thread), windows.CloseHandle(owner.info.Process))
}
