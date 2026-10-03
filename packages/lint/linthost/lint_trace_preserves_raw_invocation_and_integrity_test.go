package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "runtime"
  "testing"
)

// TestLintTracePreservesRawInvocationAndIntegrity owns the private writer's
// actual raw-file and JSONL operations, including duplicate-file refusal and
// total-budget refusal. It does not launch a loader or certify native transport.
//
// @evidence contracts/testing.md#behavioral-verification Actual capture writes independently authored raw bytes, record appends one parsed JSONL event, duplicate exclusive-create fails without changing the original file, and exhausted total budget writes no new payload.
// @evidence contracts/testing.md#independent-expectations The authored byte array includes NUL and invalid UTF-8 and is compared byte-for-byte; schema, invocation, sequence and event literals are fixed independently of writer output.
// @evidence contracts/testing.md#distinguishing-cases Successful capture and event correlate one invocation; absent bytes, duplicate create, exhausted budget and disabled marker have distinct observable outcomes. Loader normalization, per-payload 64MiB boundary and native child survival are not established here.
// @evidence contracts/testing.md#execution-ownership This same-process Go unit owns real temp-directory writer operations and an exact saved/restored environment marker; no subprocess, installed consumer or loader response is fabricated.
func TestLintTracePreservesRawInvocationAndIntegrity(t *testing.T) {
  root := t.TempDir()
  writer := &lintTraceWriter{root: root, instance: "authored-instance"}
  invocation := &lintTraceInvocation{writer: writer, ordinal: 7, id: "authored-instance:7"}
  raw := []byte{'{', 0, 0xff, '}', '\n'}
  metadata := invocation.capture("loader-raw", raw)
  if metadata["outcome"] != "complete" || metadata["length"] != len(raw) {
    t.Fatalf("capture metadata: %v", metadata)
  }
  payloadPath, ok := metadata["path"].(string)
  if !ok || payloadPath != fmt.Sprintf("%d-authored-instance-7-loader-raw.bin", os.Getpid()) {
    t.Fatalf("capture relative path: %v", metadata)
  }
  got, err := os.ReadFile(filepath.Join(root, payloadPath))
  if err != nil || !bytes.Equal(got, raw) {
    t.Fatalf("raw payload mismatch: bytes=%v error=%v", got, err)
  }
  callerData := map[string]any{"raw": metadata, "normalizationAccepted": false, "writerRuntime": "caller-supplied"}
  invocation.record("config-loader-result", callerData)
  if callerData["writerRuntime"] != "caller-supplied" {
    t.Fatal("observation must not mutate caller data")
  }
  events, err := filepath.Glob(filepath.Join(root, "*.jsonl"))
  if err != nil || len(events) != 1 {
    t.Fatalf("event files=%v error=%v", events, err)
  }
  eventBytes, err := os.ReadFile(events[0])
  if err != nil || bytes.Count(eventBytes, []byte{'\n'}) != 1 {
    t.Fatalf("event bytes=%q error=%v", eventBytes, err)
  }
  var event struct {
    Schema int `json:"schema"`
    Event string `json:"event"`
    WriterPID int `json:"writerPid"`
    PID int `json:"pid"`
    Instance string `json:"instance"`
    Sequence int `json:"sequence"`
    Invocation string `json:"invocation"`
    Data struct {
      WriterRuntime string `json:"writerRuntime"`
      NormalizationAccepted *bool `json:"normalizationAccepted"`
      Raw struct {
        Path string `json:"path"`
        Outcome string `json:"outcome"`
        Length int `json:"length"`
      } `json:"raw"`
    } `json:"data"`
  }
  if err := json.Unmarshal(eventBytes, &event); err != nil {
    t.Fatalf("event parse: %v", err)
  }
  if event.Schema != 1 || event.Event != "config-loader-result" ||
    event.WriterPID != os.Getpid() || event.PID != os.Getpid() ||
    event.Instance != "authored-instance" || event.Sequence != 1 ||
    event.Invocation != "authored-instance:7" || event.Data.NormalizationAccepted == nil || *event.Data.NormalizationAccepted ||
    event.Data.WriterRuntime != runtime.Version() ||
    event.Data.Raw.Path != payloadPath || event.Data.Raw.Outcome != "complete" || event.Data.Raw.Length != len(raw) {
    t.Fatalf("event mismatch: %+v", event)
  }
  duplicate := invocation.capture("loader-raw", []byte("replacement"))
  if duplicate["outcome"] != "IO-failed" {
    t.Fatalf("duplicate outcome: %v", duplicate)
  }
  got, err = os.ReadFile(filepath.Join(root, payloadPath))
  if err != nil || !bytes.Equal(got, raw) {
    t.Fatalf("duplicate overwrote original: bytes=%v error=%v", got, err)
  }
  eventBytes, err = os.ReadFile(events[0])
  if err != nil {
    t.Fatalf("read integrity events: %v", err)
  }
  lines := bytes.Split(bytes.TrimSuffix(eventBytes, []byte{'\n'}), []byte{'\n'})
  if len(lines) != 2 {
    t.Fatalf("expected original and explicit integrity event: %q", eventBytes)
  }
  var integrity struct {
    Event string `json:"event"`
    Invocation string `json:"invocation"`
    Sequence int `json:"sequence"`
    Data struct {
      WriterRuntime string `json:"writerRuntime"`
      Operation string `json:"operation"`
      Payload struct {
        Outcome string `json:"outcome"`
        Error string `json:"error"`
      } `json:"payload"`
    } `json:"data"`
  }
  if err := json.Unmarshal(lines[1], &integrity); err != nil {
    t.Fatalf("integrity event parse: %v", err)
  }
  if integrity.Event != "trace-integrity-failure" || integrity.Invocation != "authored-instance:7" ||
    integrity.Sequence != 2 || integrity.Data.WriterRuntime != runtime.Version() || integrity.Data.Operation != "payload-capture" ||
    integrity.Data.Payload.Outcome != "IO-failed" || integrity.Data.Payload.Error == "" {
    t.Fatalf("integrity event mismatch: %+v", integrity)
  }
  absent := invocation.capture("absent", nil)
  if absent["outcome"] != "absent" || absent["length"] != 0 {
    t.Fatalf("absent outcome: %v", absent)
  }
  writer.bytes = (256 << 20) - 1
  refused := invocation.capture("budget", []byte{1, 2})
  if refused["outcome"] != "too-large" || refused["length"] != 2 || refused["path"] != nil {
    t.Fatalf("budget outcome: %v", refused)
  }
  files, err := filepath.Glob(filepath.Join(root, "*.bin"))
  if err != nil || len(files) != 1 {
    t.Fatalf("unexpected payload population=%v error=%v", files, err)
  }
  t.Setenv("TTSC_E2E_TRACE", "")
  if disabled := newLintTraceInvocation(); disabled != nil {
    t.Fatal("empty opt-in marker must disable observation")
  }
  var disabled *lintTraceInvocation
  disabled.record("not-an-event", nil)
  if disabled.capture("not-a-payload", raw) != nil {
    t.Fatal("disabled capture must be absent")
  }
}
