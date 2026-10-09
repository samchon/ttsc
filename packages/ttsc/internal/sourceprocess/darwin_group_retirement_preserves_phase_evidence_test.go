//go:build darwin

package sourceprocess

import (
  "bytes"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "strconv"
  "strings"
  "syscall"
  "testing"
  "time"
)

// TestDarwinGroupRetirementPreservesPhaseEvidence verifies actual Darwin
// retirement independently of the direct child's already-exited state.
// A retained wait status reserves the original PGID during the final signal;
// signal refusal must not be confused with independently observed group absence.
//
// 1. Run the owning protocol through normal, nonzero, descendant and EOF paths.
// 2. Record every original receipt before checking command and cleanup results.
// 3. Repeat the native signal/Wait/group observations as independent OS controls.
//
// @evidence contracts/testing.md#behavioral-verification The actual Run entry owns authored native test children and must publish their original status and joined, empty-boundary cleanup. Readiness observes actual publication, filesystem failure or original completion without imposing a successful-work deadline. Independent Darwin controls retain the pre-Wait signal errno, original Wait outcome and post-Wait group observation in failure output.
// @evidence contracts/testing.md#independent-expectations Authored children exit zero or seven; EOF must cancel an admitted parent and descendant. Original exec.Cmd.Wait and ESRCH from a separate post-Wait group query provide distinct direct-child and group evidence. No EPERM is treated as absence, and these controls do not reproduce cross-UID permission refusal.
// @evidence contracts/testing.md#distinguishing-cases Natural zero and nonzero exits contrast with a surviving descendant and EOF while both processes are active. Every row runs independently, so one unknown receipt cannot hide later native controls. Installed SDK interpretation remains with the runtime E2E population.
// @evidence contracts/testing.md#execution-ownership This package unit directly calls Run and native process primitives using only its existing test executable as authored input. It builds no artifact or consumer. Original Run completion, unreaped direct-child exit observation and the authored grandchild's Wait terminate their own readiness observations; no request timeout cuts off ordinary work. The direct control preserves its original wait status until the final group signal, sends no destructive group signal after Wait and retains directories when boundary retirement is unproved. The existing post-Wait five-second absence budget remains an explicit shutdown/UNKNOWN policy.
func TestDarwinGroupRetirementPreservesPhaseEvidence(t *testing.T) {
  if role := os.Getenv("TTSC_DARWIN_RETIREMENT_ROLE"); role != "" {
    darwinRetirementChild(role)
    return
  }
  executable, err := os.Executable()
  if err != nil {
    t.Fatal(err)
  }
  suite := t
  for _, mode := range []string{"normal", "nonzero", "descendant", "eof"} {
    t.Run("protocol/"+mode, func(t *testing.T) {
      directory, req := darwinRetirementRequest(t, executable, mode)
      data, err := json.Marshal(req)
      if err != nil {
        t.Fatal(err)
      }
      reader, writer := io.Pipe()
      completed := make(chan struct{})
      var code int
      go func() {
        code = Run([]string{"--result", filepath.Join(directory, "result.json")}, reader, io.Discard, io.Discard)
        close(completed)
      }()
      if _, err = writer.Write(append(data, '\n')); err != nil {
        t.Fatal(err)
      }
      readyErr := darwinRetirementReady(filepath.Join(directory, "ready"), completed)
      ready := readyErr == nil
      if readyErr != nil {
        t.Error(readyErr)
      }
      if !ready || mode == "eof" {
        _ = writer.Close()
      } else if err := os.WriteFile(filepath.Join(directory, "release"), nil, 0600); err != nil {
        t.Error(err)
        _ = writer.Close()
      }
      <-completed
      _ = writer.Close()
      _ = reader.Close()
      raw, err := os.ReadFile(filepath.Join(directory, "result.json"))
      suite.Logf("protocol mode=%s exit=%d directory=%s receipt=%s readError=%v", mode, code, directory, raw, err)
      var actual result
      if err != nil || json.Unmarshal(raw, &actual) != nil {
        t.Error("original completion receipt is unavailable; inputs retained")
        return
      }
      if actual.Cleanup.DirectChildJoined && actual.Cleanup.BoundaryEmpty {
        defer os.RemoveAll(directory)
      } else {
        t.Error("original child/group retirement was not proved; inputs retained")
      }
      published, readErr := os.ReadFile(filepath.Join(directory, "ready"))
      publishedPID, parseErr := strconv.Atoi(string(published))
      if !ready || code != 0 || actual.Pid <= 0 || readErr != nil || parseErr != nil || actual.Pid != publishedPID {
        t.Error("protocol did not complete the original admitted authored command")
      }
      if mode == "eof" {
        if !actual.Cancelled || actual.Error == nil || actual.Error.Code != "ECANCELED" {
          t.Error("EOF did not preserve cancellation result")
        }
      } else {
        expected := 0
        if mode == "nonzero" {
          expected = 7
        }
        if actual.Cancelled || actual.Error != nil || actual.Status == nil || *actual.Status != expected {
          t.Errorf("natural command result changed: expected status %d", expected)
        }
      }
    })
  }
  for _, mode := range []string{"normal", "nonzero", "descendant", "eof"} {
    t.Run("control/"+mode, func(t *testing.T) {
      directory, req := darwinRetirementRequest(t, executable, mode)
      cmd := exec.Command(req.Command, req.Args...)
      cmd.Dir, cmd.Env = req.Cwd, environment(req.Env)
      cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
      if err := cmd.Start(); err != nil {
        t.Fatal(err)
      }
      originalPID := cmd.Process.Pid
      exited := make(chan struct{})
      var observeErr error
      go func() {
        observeErr = <-observeExit(originalPID)
        close(exited)
      }()
      readyErr := darwinRetirementReady(filepath.Join(directory, "ready"), exited)
      ready := readyErr == nil
      if readyErr != nil {
        t.Error(readyErr)
      }
      observed := false
      if ready && mode != "eof" {
        if err := os.WriteFile(filepath.Join(directory, "release"), nil, 0600); err != nil {
          t.Error(err)
        } else {
          <-exited
          observed = true
        }
      }
      // The direct child is still unreaped here, including natural exits.
      before := syscall.Kill(-originalPID, 0)
      finalSignal := syscall.Kill(-originalPID, syscall.SIGKILL)
      if !observed {
        <-exited
      }
      waitErr := cmd.Wait()
      post := syscall.Kill(-originalPID, 0)
      firstPost := post
      deadline := time.Now().Add(5 * time.Second)
      for !errors.Is(post, syscall.ESRCH) && time.Now().Before(deadline) {
        time.Sleep(10 * time.Millisecond)
        post = syscall.Kill(-originalPID, 0)
      }
      phase := map[string]any{"mode": mode, "pid": originalPID, "ready": ready, "beforeWaitGroup": darwinRetirementErrno(before), "finalSignal": darwinRetirementErrno(finalSignal), "observe": darwinRetirementErrno(observeErr), "wait": darwinRetirementErrno(waitErr), "firstPostWaitGroup": darwinRetirementErrno(firstPost), "postWaitGroup": darwinRetirementErrno(post)}
      if cmd.ProcessState != nil {
        phase["status"] = cmd.ProcessState.ExitCode()
        phase["signal"] = commandSignal(cmd.ProcessState)
      }
      encoded, _ := json.Marshal(phase)
      suite.Logf("native phases=%s directory=%s", encoded, directory)
      if errors.Is(post, syscall.ESRCH) {
        defer os.RemoveAll(directory)
      } else {
        t.Error("independent group absence unproved; inputs retained")
      }
      if !ready || observeErr != nil || cmd.ProcessState == nil {
        t.Error("original native lifecycle observation failed")
      }
      if mode != "eof" && cmd.ProcessState != nil {
        expected := 0
        if mode == "nonzero" {
          expected = 7
        }
        if cmd.ProcessState.ExitCode() != expected {
          t.Errorf("original Wait status=%d expected=%d", cmd.ProcessState.ExitCode(), expected)
        }
      } else if cmd.ProcessState != nil {
        status, ok := cmd.ProcessState.Sys().(syscall.WaitStatus)
        if !ok || !status.Signaled() || status.Signal() != syscall.SIGKILL {
          t.Error("active original child did not terminate from the before-Wait final signal")
        }
      }
    })
  }
}

func darwinRetirementRequest(t *testing.T, executable, mode string) (string, request) {
  t.Helper()
  directory, err := os.MkdirTemp("", "ttsc-darwin-retirement-")
  if err != nil {
    t.Fatal(err)
  }
  env := make(map[string]string)
  for _, entry := range os.Environ() {
    key, value, found := strings.Cut(entry, "=")
    if found {
      env[key] = value
    }
  }
  env["TTSC_DARWIN_RETIREMENT_ROLE"] = mode
  env["TTSC_DARWIN_RETIREMENT_DIRECTORY"] = directory
  return directory, request{Version: 1, Command: executable, Args: []string{"-test.run=^TestDarwinGroupRetirementPreservesPhaseEvidence$"}, Cwd: directory, Env: env}
}

// Readiness belongs to the original producer, not to elapsed scheduler time.
// The caller retains its completion result; closing completed reports actual
// completion or observation failure without reaping the control's direct child.
func darwinRetirementReady(file string, completed <-chan struct{}) error {
  ticker := time.NewTicker(5 * time.Millisecond)
  defer ticker.Stop()
  for {
    data, err := os.ReadFile(file)
    if err == nil && len(bytes.TrimSpace(data)) > 0 {
      return nil
    }
    if err != nil && !errors.Is(err, os.ErrNotExist) {
      return fmt.Errorf("authored native readiness %s: %w", file, err)
    }
    select {
    case <-completed:
      return fmt.Errorf("authored native command completed before readiness: %s", file)
    case <-ticker.C:
    }
  }
}

func darwinRetirementChild(role string) {
  directory := os.Getenv("TTSC_DARWIN_RETIREMENT_DIRECTORY")
  if role == "grandchild" {
    if err := os.WriteFile(filepath.Join(directory, "grandchild"), []byte(strconv.Itoa(os.Getpid())), 0600); err != nil {
      os.Exit(90)
    }
    for {
      time.Sleep(time.Second)
    }
  }
  if role == "descendant" || role == "eof" {
    executable, err := os.Executable()
    if err != nil {
      os.Exit(91)
    }
    cmd := exec.Command(executable, "-test.run=^TestDarwinGroupRetirementPreservesPhaseEvidence$")
    cmd.Env = append(os.Environ(), "TTSC_DARWIN_RETIREMENT_ROLE=grandchild")
    if err := cmd.Start(); err != nil {
      os.Exit(92)
    }
    completed := make(chan struct{})
    var waitErr error
    go func() {
      waitErr = cmd.Wait()
      close(completed)
    }()
    if err := darwinRetirementReady(filepath.Join(directory, "grandchild"), completed); err != nil {
      fmt.Fprintln(os.Stderr, err)
      select {
      case <-completed:
        fmt.Fprintf(os.Stderr, "original grandchild Wait: %v\n", waitErr)
      default:
      }
      os.Exit(94)
    }
  }
  if err := os.WriteFile(filepath.Join(directory, "ready"), []byte(strconv.Itoa(os.Getpid())), 0600); err != nil {
    os.Exit(93)
  }
  for {
    if role != "eof" {
      if _, err := os.Stat(filepath.Join(directory, "release")); err == nil {
        break
      }
    }
    time.Sleep(5 * time.Millisecond)
  }
  if role == "nonzero" {
    os.Exit(7)
  }
  os.Exit(0)
}

func darwinRetirementErrno(err error) map[string]any {
  value := map[string]any{"message": "", "errno": nil}
  if err != nil {
    value["message"] = err.Error()
  }
  var errno syscall.Errno
  if errors.As(err, &errno) {
    value["errno"] = int(errno)
  }
  return value
}
