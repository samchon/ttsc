// Package sourceprocess owns a native command and its process boundary until
// completion or cancellation. It serves the SDK's synchronous worker relay.
package sourceprocess

import (
  "bufio"
  "bytes"
  "encoding/base64"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "sort"
  "sync"
  "time"
)

// Run executes the private source-process protocol. The first stdin line is a
// JSON command; subsequent EOF cancels it. Child stdin is independent of this
// control stream. Output streams carry only the child's bytes, while the
// caller-owned result pathname receives an atomic completion record.
//
// @evidence contracts/common.md#principled-implementation Command decoding precedes acquisition; the OS owner returns only after its direct child and process boundary have been observed, and publication preserves failure instead of inventing successful completion.
// @evidence contracts/common.md#clear-and-simple-design One entry separates control input, native execution and completion publication; platform adapters own containment and private inner dispatch.
// @evidence contracts/common.md#prohibited-implementation-shortcuts EOF invokes actual process retirement, without extending command deadlines or substituting a warm artifact.
// @evidence contracts/common.md#meaningful-documentation The declaration explains separate control and child input streams and the private result-file contract.
// @evidence contracts/portability.md#os-neutral-implementation JSON preserves argv and environment values; native adapters implement Windows Job and POSIX process-group distinctions without shell concatenation.
// @evidence contracts/performance.md#efficient-algorithms Decoding retains one complete request and optional decoded stdin; command output streams directly to the supplied writers instead of buffering it in this owner.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Commands can have effects and are executed independently; plugin-key reuse remains with the SDK.
// @evidence contracts/performance.md#bound-retention-and-release-resources The standalone helper owns one control reader until process exit and delegates native handles to its OS adapter; publication failure exits unsuccessfully without claiming cleanup or a usable completion record.
func Run(args []string, in io.Reader, out, stderr io.Writer) int {
  if len(args) > 0 && args[0] == "--inner" {
    return runInner(args[1:], in, out, stderr)
  }
  if len(args) != 2 || args[0] != "--result" || !filepath.IsAbs(args[1]) {
    fmt.Fprintln(stderr, "ttsc: source process requires --result and an absolute private result path")
    return 2
  }
  reader := bufio.NewReader(in)
  line, readErr := reader.ReadBytes('\n')
  req, decodeErr := decodeRequest(line)
  var completed result
  if readErr != nil || decodeErr != nil {
    if decodeErr == nil {
      decodeErr = readErr
    }
    completed = failure("EINVAL", fmt.Sprintf("invalid source process request: %v", decodeErr))
  } else {
    cancel := make(chan struct{})
    go func() {
      _, _ = io.Copy(io.Discard, reader)
      close(cancel)
    }()
    completed = runCommand(req, cancel, out, stderr)
  }
  if err := writeResult(args[1], completed); err != nil {
    fmt.Fprintf(stderr, "ttsc: source process completion publication failed: %v\n", err)
    return 1
  }
  return 0
}

type request struct {
  Version                  int               `json:"version"`
  Command                  string            `json:"command"`
  Argv0                    *string           `json:"argv0,omitempty"`
  Args                     []string          `json:"args"`
  Cwd                      string            `json:"cwd"`
  Env                      map[string]string `json:"env"`
  InputBase64              string            `json:"inputBase64,omitempty"`
  WindowsVerbatimArguments bool              `json:"windowsVerbatimArguments,omitempty"`
  TimeoutMs                int64             `json:"timeoutMs,omitempty"`
}

type result struct {
  Version   int           `json:"version"`
  Pid       int           `json:"pid"`
  Status    *int          `json:"status"`
  Signal    *string       `json:"signal"`
  Error     *processError `json:"error,omitempty"`
  Cancelled bool          `json:"cancelled"`
  Cleanup   cleanupProof  `json:"cleanup"`
}

type processError struct {
  Code    string `json:"code"`
  Message string `json:"message"`
}

type cleanupProof struct {
  DirectChildJoined bool   `json:"directChildJoined"`
  BoundaryEmpty     bool   `json:"boundaryEmpty"`
  OrphanReaping     string `json:"orphanReaping"`
}

func decodeRequest(data []byte) (request, error) {
  var req request
  decoder := json.NewDecoder(bytes.NewReader(data))
  decoder.DisallowUnknownFields()
  if err := decoder.Decode(&req); err != nil {
    return req, err
  }
  var extra any
  if err := decoder.Decode(&extra); err != io.EOF {
    return req, errors.New("request must contain exactly one JSON value")
  }
  if req.Version != 1 || req.Command == "" || !filepath.IsAbs(req.Cwd) || req.Env == nil || req.TimeoutMs < 0 || req.TimeoutMs > int64((1<<63-1)/time.Millisecond) {
    return req, errors.New("invalid version, executable, cwd, environment or timeout")
  }
  if _, err := inputBytes(req); err != nil {
    return req, err
  }
  return req, nil
}

func inputBytes(req request) ([]byte, error) { return base64.StdEncoding.DecodeString(req.InputBase64) }

// openInput supplies a native regular handle, not a copy goroutine that can
// remain blocked after the direct child exits while a descendant holds stdin.
func openInput(req request, directory string) (*os.File, func() error, error) {
  input, err := inputBytes(req)
  if err != nil {
    return nil, nil, err
  }
  if len(input) == 0 {
    file, err := os.Open(os.DevNull)
    if err != nil {
      return nil, nil, err
    }
    return file, file.Close, nil
  }
  file, err := os.CreateTemp(directory, "stdin-*")
  if err != nil {
    return nil, nil, err
  }
  var once sync.Once
  var cleanupErr error
  cleanup := func() error {
    once.Do(func() { cleanupErr = errors.Join(file.Close(), os.Remove(file.Name())) })
    return cleanupErr
  }
  if _, err = file.Write(input); err != nil {
    return nil, nil, errors.Join(err, cleanup())
  }
  if _, err = file.Seek(0, io.SeekStart); err != nil {
    return nil, nil, errors.Join(err, cleanup())
  }
  return file, cleanup, nil
}

func environment(values map[string]string) []string {
  keys := make([]string, 0, len(values))
  for key := range values {
    keys = append(keys, key)
  }
  sort.Strings(keys)
  entries := make([]string, 0, len(keys))
  for _, key := range keys {
    entries = append(entries, key+"="+values[key])
  }
  return entries
}

func failure(code, message string) result {
  return result{Version: 1, Error: &processError{Code: code, Message: message}}
}

func commandResult(cmd *exec.Cmd, err error) result {
  value := result{Version: 1}
  if cmd.Process != nil {
    value.Pid = cmd.Process.Pid
  }
  if cmd.ProcessState != nil {
    value.Cleanup.DirectChildJoined = true
    code := cmd.ProcessState.ExitCode()
    if code >= 0 {
      value.Status = &code
    }
    value.Signal = commandSignal(cmd.ProcessState)
  }
  var exit *exec.ExitError
  if err != nil && !errors.As(err, &exit) {
    value.Error = &processError{Code: "EIO", Message: err.Error()}
    if errors.Is(err, os.ErrNotExist) || errors.Is(err, exec.ErrNotFound) {
      value.Error.Code = "ENOENT"
    }
    if errors.Is(err, os.ErrPermission) {
      value.Error.Code = "EACCES"
    }
  }
  return value
}

func writeResult(location string, value result) error {
  data, err := json.Marshal(value)
  if err != nil {
    return err
  }
  file, err := os.CreateTemp(filepath.Dir(location), ".source-process-result-*")
  if err != nil {
    return err
  }
  temporary := file.Name()
  defer os.Remove(temporary)
  if _, err = file.Write(data); err != nil {
    _ = file.Close()
    return err
  }
  if err = file.Close(); err != nil {
    return err
  }
  return os.Rename(temporary, location)
}
