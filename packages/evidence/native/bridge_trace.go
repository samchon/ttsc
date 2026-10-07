package evidence

import (
  "encoding/json"
  "errors"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strconv"
  "strings"
  "sync"
  "syscall"
  "time"
)

const evidenceTraceLimit = 256 * 1024 * 1024
const evidenceTraceFailureReserve = 4096

var evidenceTraceOnce sync.Once
var evidenceTraceSink *evidenceTraceWriter

// evidenceTraceWriter owns one private opt-in measurement stream, never a
// product reply or a cache. Its mutex serializes counters, budget and appends.
// Files live in the coordinator's existing absolute scratch directory; the
// coordinator retains them until actual processes join and inspection ends.
//
// Principled implementation: A process PID plus CreateTemp nonce separates
// concurrent writers; exclusive native creation establishes stream identity.
// Clear and simple design: One writer owns every event and payload budget.
// Prohibited implementation shortcuts: Disabled observation does no IO, and
// capture failures neither supply results nor change protocol or cache values.
// Meaningful documentation: Ownership, activation, limits and failure effects
// are stated here; this private type is not a product configuration surface.
// OS-neutral implementation: Native absolute paths and Go file operations own
// the side channel without a shell or assumptions about filesystem case.
// Bound retention and release resources: No file handle stays open between
// writes. Total bytes are capped; file retention belongs to the coordinator.
type evidenceTraceWriter struct {
  mutex     sync.Mutex
  directory string
  path      string
  instance  string
  pid       int
  ordinal   uint64
  sequence  uint64
  bytes     int
}

// evidenceBridgeTrace pairs one actual lookup with its subsequent Run/parse.
// An unpaired direct normalizer call explicitly lacks a native lookup value.
// It retains only the writer and ordinal, not replies or historical requests.
type evidenceBridgeTrace struct {
  writer       *evidenceTraceWriter
  invocation   string
  kind         string
  nativeLookup bool
}

// evidenceTraceEvent is the shared schema-v1 envelope. PID names the observed
// subject, while WriterPID/Instance identify the writer. A pre-start failure
// has PID zero; an invocation does not imply an actual process or Program.
type evidenceTraceEvent struct {
  Schema     int    `json:"schema"`
  Event      string `json:"event"`
  WriterPID  int    `json:"writerPid"`
  Instance   string `json:"instance"`
  Sequence   uint64 `json:"sequence"`
  At         string `json:"at"`
  Invocation string `json:"invocation"`
  PID        int    `json:"pid"`
  Data       any    `json:"data"`
}

// newEvidenceBridgeTrace allocates a process-local invocation only when the
// coordinator opted in before the first request. The sink is initialized once
// per process, so later environment edits cannot split one writer's budget.
//
// Principled implementation: The ordinal is allocated under the writer mutex;
// it is private trace context and is never marshaled into a product request.
// Clear and simple design: The existing callers carry this optional pointer.
// Prohibited implementation shortcuts: A missing/invalid sink disables capture
// but does not fabricate a successful event; the coordinator detects absence.
// Efficient algorithms: Initialization is once; each allocation is constant
// work and retains no request content or completed invocation map.
// Reuse equivalent work: The same writer/budget serves both bridge owners;
// product computations and cache admission remain with their existing owners.
// Bound retention and release resources: Only counters/mutex/path persist.
// Initialization closes its exclusive stream handle before returning.
// OS-neutral implementation: The opt-in path must be an existing absolute
// native directory. Helper-owned temp nonces and PIDs do not encode source paths.
func newEvidenceBridgeTrace(kind string) *evidenceBridgeTrace {
  evidenceTraceOnce.Do(func() {
    directory := os.Getenv("TTSC_E2E_TRACE")
    if directory == "" || !filepath.IsAbs(directory) {
      return
    }
    info, err := os.Stat(directory)
    if err != nil || !info.IsDir() {
      return
    }
    writer := &evidenceTraceWriter{directory: directory, pid: os.Getpid()}
    prefix := strconv.Itoa(writer.pid) + "-"
    file, err := os.CreateTemp(directory, prefix+"*.jsonl")
    if err != nil {
      return
    }
    writer.path = file.Name()
    writer.instance = strings.TrimSuffix(strings.TrimPrefix(filepath.Base(writer.path), prefix), ".jsonl")
    if err := file.Close(); err != nil {
      return
    }
    evidenceTraceSink = writer
  })
  writer := evidenceTraceSink
  if writer == nil {
    return nil
  }
  writer.mutex.Lock()
  writer.ordinal++
  invocation := strconv.FormatUint(writer.ordinal, 10)
  writer.mutex.Unlock()
  return &evidenceBridgeTrace{writer: writer, invocation: invocation, kind: kind}
}

// record appends one observed event, with failures reported only to the trace.
// The caller's actual values are serialized, never generated as an oracle.
// Each event's transient encoding costs its data size; no event is retained.
func (trace *evidenceBridgeTrace) record(event string, pid int, data map[string]any) {
  if trace == nil {
    return
  }
  writer := trace.writer
  writer.mutex.Lock()
  defer writer.mutex.Unlock()
  if err := writer.append(trace.invocation, event, pid, data, false); err != nil {
    // One bounded failure attempt avoids recursion when the sink itself fails.
    _ = writer.append(trace.invocation, "trace-integrity-failure", writer.pid,
      map[string]any{"bridge": trace.kind, "operation": event, "error": err.Error()}, true)
  }
}

// append is called with the writer lock held. It charges attempted bytes before
// IO, bounds the complete stream, and closes the append handle on every path.
// A reserved tail permits an integrity event after the ordinary budget ends.
// Core invocation includes the writer instance; the private ordinal remains
// unchanged for payload filenames and all events use this same boundary.
// A transient shallow copy preserves caller data while binding the actual Go
// writer runtime; it does not identify the Node child or installed artifact.
// It never prints or returns an error to the product operation.
func (writer *evidenceTraceWriter) append(invocation string, event string, pid int, data map[string]any, failure bool) error {
  writer.sequence++
  observedData := make(map[string]any, len(data)+1)
  for key, value := range data {
    observedData[key] = value
  }
  observedData["writerRuntime"] = runtime.Version()
  encoded, err := json.Marshal(evidenceTraceEvent{
    Schema: 1, Event: event, WriterPID: writer.pid, Instance: writer.instance,
    Sequence: writer.sequence, At: time.Now().UTC().Format(time.RFC3339Nano),
    Invocation: writer.instance + ":" + invocation, PID: pid, Data: observedData,
  })
  if err != nil {
    return err
  }
  encoded = append(encoded, '\n')
  limit := evidenceTraceLimit - evidenceTraceFailureReserve
  if failure {
    limit = evidenceTraceLimit
  }
  if len(encoded) > limit-writer.bytes {
    return errors.New("Evidence trace writer byte budget exceeded")
  }
  writer.bytes += len(encoded)
  file, err := os.OpenFile(writer.path, os.O_WRONLY|os.O_APPEND, 0o600)
  if err != nil {
    return err
  }
  count, writeErr := file.Write(encoded)
  closeErr := file.Close()
  if writeErr != nil {
    return writeErr
  }
  if count != len(encoded) {
    return io.ErrShortWrite
  }
  return closeErr
}

// capture saves exactly the existing bounded stdout bytes, not reconstructed
// JSON. A product overflow makes the observation too-large even if its buffered
// prefix was saved; it cannot serve as a complete wire oracle. Payload names
// contain only writer-owned identities. No buffer survives this invocation.
//
// Principled implementation: Raw bytes and capture status are separate; a
// prefix, IO failure or budget refusal never becomes a successful observation.
// Efficient algorithms: One write of the existing slice adds no raw-byte copy.
// Bound retention and release resources: The existing product limit and 64MiB
// observation cap bound each payload; the writer's shared 256MiB budget bounds
// all files/events. Exclusive creation and immediate close own every handle.
// OS-neutral implementation: filepath.Join and Go IO resolve only a helper-
// owned basename within the established native scratch directory.
func (trace *evidenceBridgeTrace) capture(content []byte, productLimit int, exceeded bool) map[string]any {
  if trace == nil {
    return nil
  }
  writer := trace.writer
  writer.mutex.Lock()
  defer writer.mutex.Unlock()
  metadata := map[string]any{"observedByteLength": len(content), "capture": "complete", "bufferedOnly": true}
  name := strconv.Itoa(writer.pid) + "-" + writer.instance + "-" + trace.invocation + "-stdout.bin"
  if productLimit > 64*1024*1024 {
    productLimit = 64 * 1024 * 1024
  }
  charge := len(content)
  if charge == 0 {
    // Empty payloads still consume a file identity; a byte-only zero charge
    // would allow unlimited empty files after the regular budget was exhausted.
    charge = 1
  }
  if len(content) > productLimit || charge > evidenceTraceLimit-evidenceTraceFailureReserve-writer.bytes {
    metadata["capture"] = "too-large"
    _ = writer.append(trace.invocation, "trace-integrity-failure", writer.pid,
      map[string]any{"bridge": trace.kind, "operation": "stdout-capture", "error": "Evidence trace payload budget exceeded"}, true)
    return metadata
  }
  writer.bytes += charge
  file, err := os.OpenFile(filepath.Join(writer.directory, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
  if err == nil {
    var count int
    count, err = file.Write(content)
    closeErr := file.Close()
    if err == nil && count != len(content) {
      err = io.ErrShortWrite
    }
    if err == nil {
      err = closeErr
    }
  }
  metadata["path"] = name
  if err != nil {
    metadata["capture"] = "IO-failed"
    metadata["error"] = err.Error()
  } else if exceeded {
    metadata["capture"] = "too-large"
  }
  if err != nil || exceeded {
    _ = writer.append(trace.invocation, "trace-integrity-failure", writer.pid,
      map[string]any{"bridge": trace.kind, "operation": "stdout-capture", "capture": metadata}, true)
  }
  return metadata
}

// attempt observes the actual prepared command without changing its streams
// or executable. The timestamp is a lower call bound, not an OS spawn time.
// Observation IO contributes opt-in overhead inside the unchanged timeout.
func (trace *evidenceBridgeTrace) attempt(command *exec.Cmd) time.Time {
  if trace == nil {
    return time.Time{}
  }
  lower := time.Now().UTC()
  trace.record("process-attempt", 0, map[string]any{
    "bridge": trace.kind, "argv": command.Args, "cwd": command.Dir,
    "executable": command.Path, "startLowerBound": lower.Format(time.RFC3339Nano),
    "started": false, "observation": "before-Cmd.Run",
  })
  return lower
}

// preparationFailure records a real failure before any Run was attempted.
// Missing stdout is absence, not an invented empty JSON response. This event
// cannot count a child start or successful parse and never replaces the error.
func (trace *evidenceBridgeTrace) preparationFailure(err error) {
  if trace == nil {
    return
  }
  trace.record("bridge-result", trace.writer.pid, map[string]any{
    "bridge": trace.kind, "nativeLookup": trace.nativeLookup, "preparationError": err.Error(),
    "stdout":           map[string]any{"capture": "absent", "observedByteLength": 0},
    "unmarshalOutcome": "not-attempted", "runAttempted": false,
  })
}

// result observes completed Run and unmarshal boundaries. The stdout capture
// is the original buffered slice; outcome IDs come only from successful actual
// native unmarshal. ProcessState is a native observation, not descendant proof.
// Signal is read only when the native Sys value exposes supported signal
// methods. Unavailable authority is distinct from an observed nonsignal exit;
// native ProcessState text is retained without parsing it into a guessed signal.
func (trace *evidenceBridgeTrace) result(command *exec.Cmd, stdout *limitedBuffer, stderr *limitedBuffer,
  start time.Time, end time.Time, runErr error, parseOutcome string, parseErr error,
  documents []string, problems []string,
) {
  if trace == nil {
    return
  }
  pid := 0
  if command.Process != nil {
    pid = command.Process.Pid
  }
  var status *int
  var signal any
  var signalNumber any
  signalObserved := false
  processState := ""
  if command.ProcessState != nil {
    value := command.ProcessState.ExitCode()
    status = &value
    processState = command.ProcessState.String()
    if state, ok := command.ProcessState.Sys().(interface {
      Signaled() bool
      Signal() syscall.Signal
    }); ok {
      signalObserved = true
      if state.Signaled() {
        signal = state.Signal().String()
        signalNumber = int(state.Signal())
      }
    }
  }
  message := ""
  if runErr != nil {
    message = runErr.Error()
  }
  trace.record("process-result", pid, map[string]any{
    "bridge": trace.kind, "argv": command.Args, "cwd": command.Dir, "executable": command.Path,
    "started": command.Process != nil, "exitObserved": command.ProcessState != nil,
    "status": status, "signal": signal, "signalNumber": signalNumber, "signalObserved": signalObserved,
    "nativeProcessState": processState, "error": message, "join": "Cmd.Run-return",
    "startLowerBound": start.Format(time.RFC3339Nano), "startUpperBound": end.Format(time.RFC3339Nano),
    "stdoutLimitExceeded": stdout.Exceeded, "stderrLimitExceeded": stderr.Exceeded,
  })
  metadata := map[string]any{"capture": "absent", "observedByteLength": 0}
  if command.Process != nil {
    metadata = trace.capture(stdout.Bytes(), stdout.Limit, stdout.Exceeded)
  }
  message = ""
  if parseErr != nil {
    message = parseErr.Error()
  }
  trace.record("bridge-result", trace.writer.pid, map[string]any{
    "bridge": trace.kind, "nativeLookup": trace.nativeLookup,
    "runAttempted": true,
    "stdout":       metadata, "unmarshalOutcome": parseOutcome, "unmarshalError": message,
    "documentIds": documents, "problemIds": problems,
  })
}
