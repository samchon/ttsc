// Package e2etrace records opt-in observations without changing product replies.
// Its coordinator owns an existing absolute TTSC_E2E_TRACE scratch directory;
// unavailable sinks leave missing evidence, never a successful measurement.
package e2etrace

import (
  "crypto/rand"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "sync"
  "syscall"
  "time"
)

// Command relates observations of one owned Cmd. It retains no process handle
// beyond the caller's existing Cmd reference and never runs or waits for it.
//
// @evidence contracts/common.md#principled-implementation The invocation identifies actual caller operations, not a synthetic child; the Cmd remains its original owner's responsibility.
// @evidence contracts/common.md#clear-and-simple-design Selected arguments, operation and call-bound time travel together with the existing Cmd reference.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign method is replaced and no guessed PID or exact OS start time is represented.
// @evidence contracts/common.md#meaningful-documentation The comment states observation-only ownership and the absence of process lifecycle actions.
// @evidence contracts/portability.md#os-neutral-implementation Cmd supplies native argv, explicit directory and actual Process/ProcessState without platform-derived capability assumptions.
// @evidenceExclude contracts/performance.md#efficient-algorithms This value carries observations; BeginCommand and Result perform their encoding.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This value does not establish computation equivalence.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The original caller owns the Cmd and discards this observation with that lifecycle; no independent task is acquired.
type Command struct {
  cmd *exec.Cmd
  invocation string
  method string
  lower time.Time
}

// BeginCommand observes the selected call before its original method executes.
// An empty/unset opt-in produces no event or filesystem IO. A failed sink is
// not reported through the product's stderr, return values or protocol streams.
//
// @evidence contracts/common.md#principled-implementation A call-local token and timestamp bound precede the original Cmd method; selected argv/directory are not substituted for executable identity.
// @evidence contracts/common.md#clear-and-simple-design One nullable observation token is returned to the owning callsite.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The opt-in is the approved observation boundary, not a product behavior branch or fixture-specific result.
// @evidence contracts/common.md#meaningful-documentation Native prose states disabled IO and failure isolation, with separate acknowledgment tags.
// @evidence contracts/portability.md#os-neutral-implementation Absolute native scratch paths and os/exec argument representation are preserved; an empty Cmd.Dir records inherited-directory intent.
// @evidence contracts/performance.md#efficient-algorithms Disabled calls inspect only the opt-in value. Enabled calls add cold entropy/nonce acquisition, mutex admission, argv/path JSON encoding and native append/close; temporary encoding follows metadata text before the writer budget is checked.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each actual invocation receives a distinct ordinal instead of reusing an event.
// @evidence contracts/performance.md#bound-retention-and-release-resources The sink serializes append/close operations and caps written bytes at 256MiB including reserved failure space, not encoding memory or child lifetime. One root/nonce and scalar counters persist for the process lifetime; the token transfers to the Cmd owner, without acquiring its child. Unwritable or partially written sinks leave missing/invalid evidence for the coordinator rather than product errors.
func BeginCommand(cmd *exec.Cmd, method string) (observation *Command) {
  defer func() { _ = recover() }()
  invocation := nextInvocation()
  if invocation == "" {
    return nil
  }
  observation = &Command{cmd: cmd, invocation: invocation, method: method, lower: time.Now()}
  observation.emit("process-attempt", nil, time.Time{})
  return observation
}

// BeginWait starts the Wait call bounds on the original invocation. It neither
// waits nor interprets an earlier Start return as child/descendant settlement.
//
// @evidence contracts/common.md#principled-implementation The resident owner retains one invocation across its explicit Start and later Wait.
// @evidence contracts/common.md#clear-and-simple-design Only the observed method and lower bound change.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No synthetic process or successful join is manufactured.
// @evidence contracts/common.md#meaningful-documentation The prose distinguishes call bounds from lifecycle settlement.
// @evidence contracts/portability.md#os-neutral-implementation The existing native Cmd representation and absolute scratch sink are passed through the shared event writer; no new directory or process identity is invented.
// @evidence contracts/performance.md#efficient-algorithms Token updates are fixed-field work; enabled emission additionally encodes its selected argv/path text.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This method labels an actual new Wait attempt, not reusable work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The existing caller retains the same token and owns its Cmd.
func (observation *Command) BeginWait() {
  defer func() { _ = recover() }()
  if observation == nil {
    return
  }
  observation.method = "Wait"
  observation.lower = time.Now()
  observation.emit("process-attempt", nil, time.Time{})
}

// Result observes the unchanged method's return. ProcessState and the returned
// error are separate: context/pipe errors can coexist with a successful exit.
// A successful explicit Start emits process-start; other returns emit result,
// never an invented exact start timestamp or descendant-close event.
//
// @evidence contracts/common.md#principled-implementation Actual Cmd.Process and ProcessState provide PID/exit observations while original returned errors remain independent data.
// @evidence contracts/common.md#clear-and-simple-design One emission distinguishes explicit Start from terminal method results without invoking a Cmd method.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No inferred constructor/process totals or foreign method replacement is used.
// @evidence contracts/common.md#meaningful-documentation The prose states bounds, exit/error separation and missing descendant-close authority.
// @evidence contracts/portability.md#os-neutral-implementation Go ProcessState supplies actual exit code and native state text without assuming a Unix signal encoding on Windows.
// @evidence contracts/performance.md#efficient-algorithms Observed metadata and selected argument strings are encoded once per method return; child output is not copied here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Recording a method result does not share its effects or establish reusable computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources Emission opens/closes its own sink file; it does not close or retain the original process, streams or task.
func (observation *Command) Result(err error) {
  defer func() { _ = recover() }()
  if observation == nil {
    return
  }
  upper := time.Now()
  event := "process-result"
  if observation.method == "Start" && err == nil && observation.cmd.Process != nil {
    event = "process-start"
  }
  observation.emit(event, err, upper)
}

// Program records an actual driver construction or installation observation.
// Upstream CLI/LSP constructions outside these callsites are not counted, and
// reusedData does not mean that a returned new Program object is absent.
//
// @evidence contracts/common.md#principled-implementation Callers emit only at actual constructor return or field-installation boundaries, identifying origin and reused data independently.
// @evidence contracts/common.md#clear-and-simple-design Program observations use the same private sink but never change compiler payloads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Events are not deduced from profile names, wrappers or elapsed time.
// @evidence contracts/common.md#meaningful-documentation The prose bounds the observed driver population and reuse interpretation.
// @evidence contracts/portability.md#os-neutral-implementation Writer PID/argv and an observed cwd value use native os APIs; cwd-query failure is represented separately.
// @evidence contracts/performance.md#efficient-algorithms Enabled emission encodes process argument/cwd text and fixed event data; disabled calls perform no file IO.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This observation does not coordinate Program reuse.
// @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous bounded sink retains only writer identity/counters; compiler ownership is unchanged.
func Program(event, origin, outcome string, reusedData bool, generation any) {
  defer func() { _ = recover() }()
  invocation := nextInvocation()
  if invocation == "" {
    return
  }
  cwd, err := os.Getwd()
  data := map[string]any{"origin": origin, "outcome": outcome, "reusedData": reusedData, "generation": fmt.Sprintf("%p", generation)}
  if err != nil {
    data["cwdError"] = err.Error()
  }
  writeEvent(event, invocation, os.Getpid(), os.Args, cwd, data)
}

func (observation *Command) emit(event string, err error, upper time.Time) {
  cmd := observation.cmd
  pid := 0
  if cmd.Process != nil {
    pid = cmd.Process.Pid
  }
  data := map[string]any{
    "method": observation.method,
    "selectedExecutable": cmd.Path,
    "started": pid > 0,
    "exitObserved": cmd.ProcessState != nil,
    "cwdInherited": cmd.Dir == "",
    "startLowerBound": observation.lower.UTC().Format(time.RFC3339Nano),
  }
  if !upper.IsZero() {
    data["startUpperBound"] = upper.UTC().Format(time.RFC3339Nano)
    data["callDurationNs"] = upper.Sub(observation.lower).Nanoseconds()
  }
  if err != nil {
    data["error"] = err.Error()
  }
  if cmd.ProcessState != nil {
    data["status"] = cmd.ProcessState.ExitCode()
    data["success"] = cmd.ProcessState.Success()
    data["nativeState"] = cmd.ProcessState.String()
    data["signal"] = nil
    data["signalObserved"] = false
    if state, ok := cmd.ProcessState.Sys().(interface {
      Signaled() bool
      Signal() syscall.Signal
    }); ok {
      data["signalObserved"] = true
      if state.Signaled() {
        data["signal"] = state.Signal().String()
      }
    }
  }
  writeEvent(event, observation.invocation, pid, cmd.Args, cmd.Dir, data)
}

const writerBudget = 256 * 1024 * 1024
const failureReserve = 1024 * 1024

var writer = struct {
  sync.Mutex
  root string
  instance string
  ordinal uint64
  sequence uint64
  bytes int64
  failed bool
}{}

func nextInvocation() string {
  root := os.Getenv("TTSC_E2E_TRACE")
  if root == "" || !filepath.IsAbs(root) {
    return ""
  }
  writer.Lock()
  defer writer.Unlock()
  if writer.instance == "" {
    var nonce [16]byte
    if _, err := io.ReadFull(rand.Reader, nonce[:]); err != nil {
      return ""
    }
    writer.root = root
    writer.instance = hex.EncodeToString(nonce[:])
  }
  if writer.root != root || writer.failed {
    return ""
  }
  writer.ordinal++
  return fmt.Sprintf("%d-%s-%d", os.Getpid(), writer.instance, writer.ordinal)
}

func writeEvent(event, invocation string, pid int, argv []string, cwd string, data map[string]any) {
  writer.Lock()
  defer writer.Unlock()
  if writer.failed || writer.root == "" || os.Getenv("TTSC_E2E_TRACE") != writer.root {
    return
  }
  writer.sequence++
  record := map[string]any{
    "schema": 1, "event": event, "writerPid": os.Getpid(), "instance": writer.instance,
    "sequence": writer.sequence, "at": time.Now().UTC().Format(time.RFC3339Nano),
    "invocation": invocation, "pid": pid, "argv": argv, "cwd": cwd, "data": data,
  }
  if lower, ok := data["startLowerBound"]; ok {
    record["startLowerBound"] = lower
  }
  if upper, ok := data["startUpperBound"]; ok {
    record["startUpperBound"] = upper
  }
  line, err := json.Marshal(record)
  if err != nil {
    writer.failed = true
    return
  }
  line = append(line, '\n')
  if writer.bytes+int64(len(line)) > writerBudget-failureReserve {
    writer.failed = true
    record["event"] = "integrity-failure"
    record["data"] = map[string]any{"outcome": "writer-budget-exceeded"}
    record["argv"] = nil
    record["cwd"] = ""
    if failure, err := json.Marshal(record); err == nil {
      appendLine(append(failure, '\n'))
    }
    return
  }
  appendLine(line)
}

func appendLine(line []byte) {
  filename := filepath.Join(writer.root, fmt.Sprintf("%d-%s.jsonl", os.Getpid(), writer.instance))
  file, err := os.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0600)
  if err != nil {
    writer.failed = true
    return
  }
  n, writeErr := file.Write(line)
  closeErr := file.Close()
  writer.bytes += int64(n)
  if writeErr != nil || closeErr != nil || n != len(line) {
    writer.failed = true
  }
}
