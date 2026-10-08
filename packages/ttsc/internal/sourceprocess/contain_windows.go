//go:build windows

package sourceprocess

import (
  "encoding/json"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "time"
  "unsafe"

  "golang.org/x/sys/windows"
)

// runCommand owns a named Windows job. Its helper joins the job before the
// START handshake permits suspended target creation. A second RUN handshake
// permits execution only after the outer knows the selected target's PID, so
// output-triggered cancellation cannot lose that PID. Cancellation before RUN
// never admits target code. Normal target completion also terminates
// surviving descendants before reporting a proven empty boundary.
// The job contains CreateProcess descendants without breakaway permission;
// processes created through external brokers such as WMI are outside that
// Windows ownership mechanism. Private control files use the caller's user
// security boundary, not isolation from other processes running as that user.
// A failed emptiness query retains the private directory instead of deleting
// input that an unverified boundary might still own.
//
// The outer owns the job and cancellation; the inner owns target execution.
// READY, STARTED and RUN separate containment, original-handle PID publication
// and execution admission. Cancellation and the requested deadline are checked
// before both authorization writes. Private control files remain independent
// of descendant-owned stdout handles. Kernel accounting establishes emptiness.
//
// Windows build constraints isolate Job APIs and command-line encoding. The
// target receives exact environment entries and ordinary argument quoting or
// the caller-requested verbatim command line. Launch preparation is linear in
// request bytes and argument count; fixed-size accounting does not enumerate
// processes. Command effects execute independently under a new job each time;
// source artifact caching belongs to the caller.
//
// Each call owns one helper, control pipe and private directory. Retirement
// joins the helper and observes zero active processes before releasing private
// files. Kernel termination or accounting failure reports an unproven boundary
// and retains its directory; job and control handles close on return.
func runCommand(req request, cancel <-chan struct{}, out, errOut io.Writer) (completed result) {
  dir, err := os.MkdirTemp("", "ttsc-source-process-")
  if err != nil {
    return failure("EIO", err.Error())
  }
  boundaryAcquired := false
  defer func() {
    if boundaryAcquired && !completed.Cleanup.BoundaryEmpty {
      return
    }
    if cleanupErr := os.RemoveAll(dir); cleanupErr != nil {
      completed.Error = &processError{Code: "EIO", Message: cleanupErr.Error()}
    }
  }()
  data, err := json.Marshal(req)
  if err != nil {
    return failure("EINVAL", err.Error())
  }
  if err = os.WriteFile(filepath.Join(dir, "request.json"), data, 0600); err != nil {
    return failure("EIO", err.Error())
  }
  name, err := windows.UTF16PtrFromString("Local\\" + filepath.Base(dir))
  if err != nil {
    return failure("EINVAL", err.Error())
  }
  job, err := windows.CreateJobObject(nil, name)
  if err != nil {
    return failure("EJOB", err.Error())
  }
  defer func() {
    if closeErr := windows.CloseHandle(job); closeErr != nil {
      completed.Error = &processError{Code: "EJOB", Message: closeErr.Error()}
    }
  }()
  limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
  limits.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
  if _, err = windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&limits)), uint32(unsafe.Sizeof(limits))); err != nil {
    return failure("EJOB", err.Error())
  }
  executable, err := os.Executable()
  if err != nil {
    return failure("EIO", err.Error())
  }
  cmd := exec.Command(executable, "__source-process", "--inner", "Local\\"+filepath.Base(dir), dir)
  cmd.Dir, cmd.Env = req.Cwd, environment(req.Env)
  cmd.Stdout, cmd.Stderr = out, errOut
  control, err := cmd.StdinPipe()
  if err != nil {
    return failure("EIO", err.Error())
  }
  defer control.Close()
  if err = cmd.Start(); err != nil {
    value := commandResult(cmd, err)
    value.Cleanup.DirectChildJoined = true
    active, queryErr := windowsJobActive(job)
    value.Cleanup.BoundaryEmpty = queryErr == nil && active == 0
    value.Cleanup.OrphanReaping = "windows-job"
    if queryErr != nil {
      value.Error = &processError{Code: "EJOB", Message: queryErr.Error()}
    }
    return value
  }
  boundaryAcquired = true
  joined := make(chan error, 1)
  go func() { joined <- cmd.Wait() }()
  ticker := time.NewTicker(10 * time.Millisecond)
  defer ticker.Stop()
  var deadline <-chan time.Time
  if req.TimeoutMs > 0 {
    timer := time.NewTimer(time.Duration(req.TimeoutMs) * time.Millisecond)
    defer timer.Stop()
    deadline = timer.C
  }
  value := failure("EPROTOCOL", "source process helper ended without a result")
  started, running, finished, cancelled, helperJoined := false, false, false, false, false
  targetPid := 0
  for !finished {
    select {
    case <-cancel:
      cancelled, finished = true, true
    case <-deadline:
      cancelled, finished = true, true
      value = failure("ETIMEDOUT", "source command exceeded its requested timeout")
    case waitErr := <-joined:
      helperJoined, finished = true, true
      if readErr := readWindowsResult(dir, &value); readErr != nil {
        value = commandResult(cmd, waitErr)
        value.Error = &processError{Code: "EPROTOCOL", Message: readErr.Error()}
      }
    case <-ticker.C:
      if readWindowsResult(dir, &value) == nil {
        finished = true
        break
      }
      if !started {
        if _, readyErr := os.Stat(filepath.Join(dir, "ready")); readyErr == nil {
          // A tick must not admit a target after cancellation was already
          // observable. Cancellation concurrent with the write remains owned
          // by the same job and is joined through the termination path.
          select {
          case <-cancel:
            cancelled, finished = true, true
          case <-deadline:
            cancelled, finished = true, true
            value = failure("ETIMEDOUT", "source command exceeded its requested timeout")
          default:
          }
          if finished {
            break
          }
          if _, err = control.Write([]byte{1}); err != nil {
            value = failure("EPIPE", err.Error())
            finished = true
          } else {
            started = true
          }
        }
      }
      if started && !running && !finished {
        var target result
        if readWindowsRecord(filepath.Join(dir, "started.json"), &target) == nil && target.Version == 1 && target.Pid > 0 {
          targetPid = target.Pid
          select {
          case <-cancel:
            cancelled, finished = true, true
          case <-deadline:
            cancelled, finished = true, true
            value = failure("ETIMEDOUT", "source command exceeded its requested timeout")
          default:
          }
          if !finished {
            if _, err = control.Write([]byte{2}); err != nil {
              value = failure("EPIPE", err.Error())
              finished = true
            } else {
              running = true
            }
            control.Close()
          }
        }
      }
    }
  }
  // A helper not yet assigned cannot have created a target. Killing it first
  // closes the only race with a zero accounting observation before assignment.
  if !started && !helperJoined {
    _ = cmd.Process.Kill()
  }
  terminationErr := windows.TerminateJobObject(job, 1)
  if !helperJoined {
    <-joined
    helperJoined = true
  }
  value.Cancelled = cancelled
  if cancelled && value.Error != nil && value.Error.Code == "EPROTOCOL" {
    value = failure("ECANCELED", "source command cancelled")
    value.Cancelled = true
  }
  if value.Pid == 0 {
    if targetPid == 0 {
      var target result
      if readWindowsRecord(filepath.Join(dir, "started.json"), &target) == nil && target.Version == 1 {
        targetPid = target.Pid
      }
    }
    value.Pid = targetPid
  }
  value.Cleanup.DirectChildJoined = helperJoined
  value.Cleanup.OrphanReaping = "windows-job"
  if terminationErr != nil {
    value.Error = &processError{Code: "EJOB", Message: terminationErr.Error()}
    return value
  }
  for {
    active, queryErr := windowsJobActive(job)
    if queryErr != nil {
      value.Error = &processError{Code: "EJOB", Message: queryErr.Error()}
      return value
    }
    if active == 0 {
      value.Cleanup.BoundaryEmpty = true
      return value
    }
    <-ticker.C
  }
}

// runInner assigns this helper before reading START. It publishes the native
// suspended target's PID before reading RUN and resuming the original primary
// thread. The target inherits the job and real standard handles, so waiting
// does not await descendant-owned Go copy pipes. Its result remains available
// before the outer joins the tree. A pre-RUN cancellation can lack a PID only
// when the suspended identity was not published; no target code then ran.
func runInner(args []string, in io.Reader, out, errOut io.Writer) int {
  if len(args) != 2 {
    return 2
  }
  name, err := windows.UTF16PtrFromString(args[0])
  if err != nil {
    return 2
  }
  openJob := windows.NewLazySystemDLL("kernel32.dll").NewProc("OpenJobObjectW")
  handle, _, callErr := openJob.Call(0x0001|0x0004, 0, uintptr(unsafe.Pointer(name)))
  if handle == 0 {
    fmt.Fprintln(errOut, callErr)
    return 2
  }
  job := windows.Handle(handle)
  if err = windows.AssignProcessToJobObject(job, windows.CurrentProcess()); err != nil {
    _ = windows.CloseHandle(job)
    fmt.Fprintln(errOut, err)
    return 2
  }
  // Membership survives handle closure. Only the outer retains a job handle,
  // so an unexpected outer exit also closes the last handle and kills this
  // helper and every inherited descendant.
  if err = windows.CloseHandle(job); err != nil {
    fmt.Fprintln(errOut, err)
    return 2
  }
  dir := args[1]
  data, err := os.ReadFile(filepath.Join(dir, "request.json"))
  if err != nil {
    return 2
  }
  var req request
  if json.Unmarshal(data, &req) != nil {
    return 2
  }
  if err = os.WriteFile(filepath.Join(dir, "ready"), nil, 0600); err != nil {
    return 2
  }
  var start [1]byte
  if _, err = io.ReadFull(in, start[:]); err != nil || start[0] != 1 {
    return 2
  }
  input, _, err := openInput(req, dir)
  if err != nil {
    _ = writeResult(filepath.Join(dir, "result.json"), failure("EINVAL", err.Error()))
    return 2
  }
  owner, launchErr := startWindowsTarget(req, input)
  if launchErr != nil {
    _ = input.Close()
    _ = writeResult(filepath.Join(dir, "result.json"), commandResult(exec.Command(req.Command, req.Args...), launchErr))
    return 0
  }
  defer owner.close()
  value := result{Version: 1, Pid: int(owner.info.ProcessId)}
  if err = writeResult(filepath.Join(dir, "started.json"), value); err != nil {
    fmt.Fprintln(errOut, err)
    _ = input.Close()
    return 2
  }
  var run [1]byte
  if _, err = io.ReadFull(in, run[:]); err != nil || run[0] != 2 {
    _ = input.Close()
    return 2
  }
  if err = owner.resume(); err != nil {
    value.Error = &processError{Code: "EPROCESS", Message: err.Error()}
  } else {
    value = owner.wait()
  }
  // Descendants may retain this file without FILE_SHARE_DELETE. The outer
  // removes it after joining the job, instead of deleting it here.
  if inputErr := input.Close(); inputErr != nil {
    value.Error = &processError{Code: "EIO", Message: inputErr.Error()}
  }
  if err = writeResult(filepath.Join(dir, "result.json"), value); err != nil {
    fmt.Fprintln(errOut, err)
    return 2
  }
  return 0
}

func readWindowsResult(dir string, value *result) error {
  return readWindowsRecord(filepath.Join(dir, "result.json"), value)
}

func readWindowsRecord(file string, value *result) error {
  data, err := os.ReadFile(file)
  if err != nil {
    return err
  }
  var decoded result
  if err := json.Unmarshal(data, &decoded); err != nil {
    return err
  }
  *value = decoded
  return nil
}

func windowsJobActive(job windows.Handle) (uint32, error) {
  // A null job can query the ambient job on Windows. Only an explicitly
  // acquired job handle may establish this command's owned boundary.
  if job == 0 || job == windows.InvalidHandle {
    return 0, windows.ERROR_INVALID_HANDLE
  }
  // JOBOBJECT_BASIC_ACCOUNTING_INFORMATION has four LARGE_INTEGER fields
  // followed by four DWORD counters, with ActiveProcesses the seventh field.
  accounting := struct {
    UserTime, KernelTime, PeriodUserTime, PeriodKernelTime           int64
    PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses uint32
  }{}
  err := windows.QueryInformationJobObject(job, windows.JobObjectBasicAccountingInformation, uintptr(unsafe.Pointer(&accounting)), uint32(unsafe.Sizeof(accounting)), nil)
  return accounting.ActiveProcesses, err
}

func commandSignal(_ *os.ProcessState) *string { return nil }
