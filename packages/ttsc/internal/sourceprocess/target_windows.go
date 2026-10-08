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
  state, err := windows.WaitForSingleObject(owner.info.Process, windows.INFINITE)
  if err != nil {
    value.Error = &processError{Code: "EPROCESS", Message: err.Error()}
    return value
  }
  if state != windows.WAIT_OBJECT_0 {
    value.Error = &processError{Code: "EPROCESS", Message: fmt.Sprintf("unexpected native target wait state %d", state)}
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
