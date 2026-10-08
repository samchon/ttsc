//go:build !windows

package sourceprocess

import (
  "fmt"
  "io"
  "os"
  "os/exec"
  "syscall"
  "time"

  "golang.org/x/sys/unix"
)

// runCommand gives the command a separate process group before exec. Both
// cancellation and ordinary target exit retire any surviving group members.
// Exit observation leaves the direct child unreaped until group termination,
// so its process-group identity cannot be reused before the final signal.
// The direct child is then waited for; Linux also reaps adopted descendants, while
// other POSIX hosts leave orphan reaping to the operating system.
//
// Setpgid establishes the boundary before target execution. Group signals
// retire inherited descendants; processes that deliberately leave the group
// are outside this boundary. Arguments and environment remain native vectors
// without a shell, and build constraints isolate native reaping differences.
//
// Each call owns one target, exit-observation goroutine and optional timer.
// Effectful commands execute independently even when their arguments match.
// Cleanup polls the group at fixed intervals; adopted-child reaping is
// proportional to exited descendants. Native refusal or a group that remains
// after the cleanup budget yields an explicit unproved-cleanup error.
func runCommand(req request, cancel <-chan struct{}, out, stderr io.Writer) (completed result) {
  if req.WindowsVerbatimArguments {
    return failure("EINVAL", "Windows verbatim arguments are unavailable on POSIX")
  }
  if err := prepareReaper(); err != nil {
    return failure("EPROCESS", err.Error())
  }
  select {
  case <-cancel:
    value := failure("ECANCELED", "source command cancelled before launch")
    value.Cancelled = true
    value.Cleanup = cleanupProof{DirectChildJoined: true, BoundaryEmpty: true, OrphanReaping: orphanReaping()}
    return value
  default:
  }
  directory, err := os.MkdirTemp("", "ttsc-source-process-")
  if err != nil {
    return failure("EIO", err.Error())
  }
  defer func() {
    if err := os.RemoveAll(directory); err != nil {
      completed.Error = &processError{Code: "EIO", Message: fmt.Sprintf("source process private-directory cleanup failed: %v", err)}
    }
  }()
  input, closeInput, err := openInput(req, directory)
  if err != nil {
    return failure("EINVAL", err.Error())
  }
  defer func() {
    if err := closeInput(); err != nil {
      completed.Error = &processError{Code: "EIO", Message: fmt.Sprintf("source process input cleanup failed: %v", err)}
    }
  }()
  cmd := exec.Command(req.Command, req.Args...)
  if req.Argv0 != nil {
    cmd.Args[0] = *req.Argv0
  }
  cmd.Dir, cmd.Env = req.Cwd, environment(req.Env)
  cmd.Stdin = input
  cmd.Stdout, cmd.Stderr = out, stderr
  cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
  if err := cmd.Start(); err != nil {
    value := commandResult(cmd, err)
    value.Cleanup = cleanupProof{DirectChildJoined: true, BoundaryEmpty: true, OrphanReaping: orphanReaping()}
    return value
  }
  exited := observeExit(cmd.Process.Pid)
  var deadline <-chan time.Time
  if req.TimeoutMs > 0 {
    timer := time.NewTimer(time.Duration(req.TimeoutMs) * time.Millisecond)
    defer timer.Stop()
    deadline = timer.C
  }
  var observationErr error
  cancelled, timedOut := false, false
  observed := false
  select {
  case observationErr = <-exited:
    observed = true
  case <-cancel:
    cancelled = true
  case <-deadline:
    cancelled, timedOut = true, true
  }
  // The direct child has not been reaped, even if it already exited. Its PID
  // therefore still reserves this group identity during the final signal.
  runErr, retirementErr := completeGroup(cmd.Process.Pid, groupOperations{
    signal: syscall.Kill,
    wait: func() error {
      if !observed {
        observationErr = <-exited
      }
      return cmd.Wait()
    },
    reap:  reapGroup,
    now:   time.Now,
    sleep: time.Sleep,
  })
  value := commandResult(cmd, runErr)
  value.Cancelled = cancelled
  value.Cleanup.OrphanReaping = orphanReaping()
  if retirementErr != nil {
    value.Error = &processError{Code: "EPROCESS", Message: retirementErr.Error()}
    return value
  }
  value.Cleanup.BoundaryEmpty = true
  if observationErr != nil {
    value.Error = &processError{Code: "EPROCESS", Message: observationErr.Error()}
  }
  if timedOut {
    value.Error = &processError{Code: "ETIMEDOUT", Message: "source command exceeded its requested timeout"}
  }
  if cancelled && !timedOut {
    value.Error = &processError{Code: "ECANCELED", Message: "source command cancelled"}
  }
  return value
}

func commandSignal(state *os.ProcessState) *string {
  status, ok := state.Sys().(syscall.WaitStatus)
  if !ok || !status.Signaled() {
    return nil
  }
  name := unix.SignalName(unix.Signal(status.Signal()))
  return &name
}

func runInner(_ []string, _ io.Reader, _ io.Writer, stderr io.Writer) int {
  fmt.Fprintln(stderr, "ttsc: source-process inner command is Windows-only")
  return 2
}
