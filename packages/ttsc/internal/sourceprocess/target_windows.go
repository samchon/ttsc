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
// @evidence contracts/common.md#principled-implementation CreateProcess returns original process and primary-thread handles atomically. CREATE_SUSPENDED and the outer RUN authorization place PID publication before target execution; ResumeThread uses that original handle and requires exactly one suspended count.
// @evidence contracts/common.md#clear-and-simple-design One selected-target owner keeps native creation, resumption, waiting and handle release together; the existing outer Job retains cancellation and descendant retirement.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Documented Windows creation and thread APIs establish the admission boundary without a PID-file-only race, uncontained execution, global thread lookup or undocumented resume functions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains original-handle identity, suspended admission and the three inherited descriptors.
// @evidence contracts/portability.md#os-neutral-implementation This Windows-only owner preserves the selected executable, argv0, verbatim argument policy, UTF-16 environment and cwd while isolating STARTUPINFOEX and native handle inheritance.
// @evidence contracts/performance.md#efficient-algorithms Command-line and environment encoding are linear in their bytes; three handles and one attribute list have fixed size, with no host-wide process or thread scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Native command effects and their process identities cannot be shared across invocations.
// @evidence contracts/performance.md#bound-retention-and-release-resources Creation releases duplicated descriptors and its attribute list on every path. The inner owns the original process/thread handles until target wait and result publication or inner exit; the outer Job retires a suspended or running target after any handshake failure.
type windowsTarget struct { info windows.ProcessInformation }

func startWindowsTarget(req request, input *os.File) (*windowsTarget, error) {
  selected := exec.Command(req.Command, req.Args...)
  if selected.Err != nil { return nil, selected.Err }
  selected.Env = environment(req.Env)
  argv := append([]string{req.Command}, req.Args...)
  if req.Argv0 != nil { argv[0] = *req.Argv0 }
  // The inner already runs in req.Cwd, matching exec.Cmd's relative executable
  // authority before CreateProcess performs its own child-directory change.
  executable, err := filepath.Abs(selected.Path)
  if err != nil { return nil, err }
  application, err := windows.UTF16PtrFromString(executable)
  if err != nil { return nil, err }
  encodedArgs := make([]string, len(argv))
  for i, arg := range argv { encodedArgs[i] = windows.EscapeArg(arg) }
  if req.WindowsVerbatimArguments { copy(encodedArgs[1:], req.Args) }
  commandLine, err := windows.UTF16PtrFromString(strings.Join(encodedArgs, " "))
  if err != nil { return nil, err }
  cwd, err := windows.UTF16PtrFromString(req.Cwd)
  if err != nil { return nil, err }
  var environmentBlock []uint16
  for _, entry := range selected.Environ() {
    encoded, err := windows.UTF16FromString(entry)
    if err != nil { return nil, err }
    environmentBlock = append(environmentBlock, encoded...)
  }
  environmentBlock = append(environmentBlock, 0)
  if len(environmentBlock) == 1 { environmentBlock = append(environmentBlock, 0) }
  handles := make([]windows.Handle, 3)
  defer func() { for _, handle := range handles { if handle != 0 { _ = windows.CloseHandle(handle) } } }()
  for i, file := range []*os.File{input, os.Stdout, os.Stderr} {
    if err := windows.DuplicateHandle(windows.CurrentProcess(), windows.Handle(file.Fd()), windows.CurrentProcess(), &handles[i], 0, true, windows.DUPLICATE_SAME_ACCESS); err != nil { return nil, err }
  }
  attributes, err := windows.NewProcThreadAttributeList(1)
  if err != nil { return nil, err }
  defer attributes.Delete()
  if err = attributes.Update(windows.PROC_THREAD_ATTRIBUTE_HANDLE_LIST, unsafe.Pointer(&handles[0]), uintptr(len(handles))*unsafe.Sizeof(handles[0])); err != nil { return nil, err }
  startup := windows.StartupInfoEx{ProcThreadAttributeList: attributes.List()}
  startup.Cb = uint32(unsafe.Sizeof(startup))
  startup.Flags = windows.STARTF_USESTDHANDLES
  startup.StdInput, startup.StdOutput, startup.StdErr = handles[0], handles[1], handles[2]
  owner := &windowsTarget{}
  err = windows.CreateProcess(application, commandLine, nil, nil, true, windows.CREATE_SUSPENDED|windows.CREATE_UNICODE_ENVIRONMENT|windows.EXTENDED_STARTUPINFO_PRESENT, &environmentBlock[0], cwd, &startup.StartupInfo, &owner.info)
  runtime.KeepAlive(handles)
  runtime.KeepAlive(environmentBlock)
  if err != nil { return nil, err }
  return owner, nil
}

func (owner *windowsTarget) resume() error {
  count, err := windows.ResumeThread(owner.info.Thread)
  if err != nil { return err }
  if count != 1 { return fmt.Errorf("source target primary thread had unexpected suspend count %d", count) }
  return nil
}

func (owner *windowsTarget) wait() result {
  value := result{Version: 1, Pid: int(owner.info.ProcessId)}
  state, err := windows.WaitForSingleObject(owner.info.Process, windows.INFINITE)
  if err != nil { value.Error = &processError{Code: "EPROCESS", Message: err.Error()}; return value }
  if state != windows.WAIT_OBJECT_0 { value.Error = &processError{Code: "EPROCESS", Message: fmt.Sprintf("unexpected native target wait state %d", state)}; return value }
  value.Cleanup.DirectChildJoined = true
  var code uint32
  if err := windows.GetExitCodeProcess(owner.info.Process, &code); err != nil { value.Error = &processError{Code: "EPROCESS", Message: err.Error()}; return value }
  status := int(code)
  value.Status = &status
  return value
}

func (owner *windowsTarget) close() error {
  return errors.Join(windows.CloseHandle(owner.info.Thread), windows.CloseHandle(owner.info.Process))
}
