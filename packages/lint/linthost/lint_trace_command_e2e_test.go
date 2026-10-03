//go:build e2e

package linthost

import (
  "crypto/sha256"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "time"
)

// recordLintCommandAttempt observes only the actual selected Cmd call.
// Disabled tracing performs no clock read, event append or filesystem operation.
func recordLintCommandAttempt(observation *lintTraceInvocation, cmd *exec.Cmd, owner string) time.Time {
  if observation == nil {
    return time.Time{}
  }
  lower := time.Now().UTC()
  observation.record("process-attempt", map[string]any{
    "pid": 0, "owner": owner, "argv": cmd.Args, "selectedPath": cmd.Path, "cwd": cmd.Dir,
    "cwdInherited": cmd.Dir == "", "startLowerBound": lower.Format(time.RFC3339Nano),
  })
  return lower
}

// recordLintCommandResult observes the returned Cmd without invoking it.
// Bounds surround the synchronous call; they are not exact OS start timestamps.
// A returned error and an observed ProcessState retain distinct meanings.
func recordLintCommandResult(observation *lintTraceInvocation, cmd *exec.Cmd, owner, method string, lower time.Time, resultErr error) {
  if observation == nil {
    return
  }
  upper := time.Now().UTC()
  pid := 0
  if cmd.Process != nil {
    pid = cmd.Process.Pid
  }
  data := map[string]any{
    "pid": pid, "owner": owner, "method": method, "argv": cmd.Args, "selectedPath": cmd.Path,
    "cwd": cmd.Dir, "cwdInherited": cmd.Dir == "", "started": pid > 0,
    "exitObserved": cmd.ProcessState != nil, "success": resultErr == nil,
    "startLowerBound": lower.Format(time.RFC3339Nano), "startUpperBound": upper.Format(time.RFC3339Nano),
  }
  if cmd.ProcessState != nil {
    data["exitCode"] = cmd.ProcessState.ExitCode()
    data["stateSuccess"] = cmd.ProcessState.Success()
    data["state"] = cmd.ProcessState.String()
  }
  if resultErr != nil {
    data["error"] = resultErr.Error()
  }
  observation.record("process-result", data)
}

// observeLintCommandArtifact retains an actual command artifact before its first use
// and any owned cleanup. Handle/path identity and unchanged metadata bound this
// reading; they do not certify which image a later OS process loaded.
// Captures are bounded to the writer's existing payload limit. Failures remain
// measurement failures without changing the selected path or test result.
func observeLintCommandArtifact(observation *lintTraceInvocation, path, owner, label string) {
  if observation == nil {
    return
  }
  data := map[string]any{"owner": owner, "requestedPath": path}
  defer func() { observation.record("native-artifact", data) }()
  fail := func(err error) {
    data["outcome"] = "IO-failed"
    data["error"] = err.Error()
    observation.record("trace-integrity-failure", map[string]any{
      "operation": "native-artifact", "requestedPath": path, "error": err.Error(),
    })
  }
  realPath, err := filepath.EvalSymlinks(path)
  if err != nil {
    fail(err)
    return
  }
  data["realPath"] = realPath
  file, err := os.Open(path)
  if err != nil {
    fail(err)
    return
  }
  before, statErr := file.Stat()
  if statErr != nil {
    closeErr := file.Close()
    fail(fmt.Errorf("stat=%v close=%v", statErr, closeErr))
    return
  }
  if !before.Mode().IsRegular() || before.Size() > 64<<20 {
    closeErr := file.Close()
    data["outcome"] = "too-large"
    if !before.Mode().IsRegular() {
      data["outcome"] = "IO-failed"
    }
    observation.record("trace-integrity-failure", map[string]any{
      "operation": "native-artifact", "requestedPath": path,
      "size": before.Size(), "mode": before.Mode().String(), "closeError": fmt.Sprint(closeErr),
    })
    return
  }
  body, readErr := io.ReadAll(io.LimitReader(file, (64<<20)+1))
  after, afterErr := file.Stat()
  pathAfter, pathErr := os.Stat(path)
  realPathAfter, realPathErr := filepath.EvalSymlinks(path)
  closeErr := file.Close()
  data["identityBefore"] = map[string]any{
    "size": before.Size(), "mode": before.Mode().String(), "modified": before.ModTime().UTC().Format(time.RFC3339Nano),
  }
  if readErr != nil || afterErr != nil || pathErr != nil || realPathErr != nil || closeErr != nil {
    fail(fmt.Errorf("read=%v handleStat=%v pathStat=%v realPath=%v close=%v", readErr, afterErr, pathErr, realPathErr, closeErr))
    return
  }
  data["identityAfter"] = map[string]any{
    "size": after.Size(), "mode": after.Mode().String(), "modified": after.ModTime().UTC().Format(time.RFC3339Nano),
  }
  data["sameHandleIdentity"] = os.SameFile(before, after)
  data["samePathIdentity"] = os.SameFile(after, pathAfter)
  data["realPathAfter"] = realPathAfter
  data["metadataUnchanged"] = before.Size() == after.Size() && before.Mode() == after.Mode() && before.ModTime().Equal(after.ModTime())
  data["observedBytes"] = len(body)
  if len(body) > 64<<20 {
    data["outcome"] = "too-large"
    observation.record("trace-integrity-failure", map[string]any{"operation": "native-artifact", "requestedPath": path, "outcome": "too-large"})
    return
  }
  if !os.SameFile(before, after) || !os.SameFile(after, pathAfter) || realPath != realPathAfter ||
    before.Size() != after.Size() || before.Mode() != after.Mode() || !before.ModTime().Equal(after.ModTime()) ||
    int64(len(body)) != before.Size() {
    fail(fmt.Errorf("native artifact identity or bytes changed during observation"))
    return
  }
  data["sha256"] = fmt.Sprintf("%x", sha256.Sum256(body))
  raw := observation.capture(label, body)
  data["raw"] = raw
  data["outcome"] = raw["outcome"]
}
