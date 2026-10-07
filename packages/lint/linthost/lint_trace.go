package linthost

import (
  "crypto/rand"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "runtime"
  "sync"
  "time"
)

// lintTraceWriter owns one private opt-in JSONL file and its payload budget.
// Each append closes its handle. The coordinator owns retention of the exact
// external directory; this writer never deletes it or changes product results.
//
// The mutex protects invocation ordinals, event sequence and the shared byte
// budget. A process nonce distinguishes this stream from later PID reuse.
type lintTraceWriter struct {
  mu       sync.Mutex
  root     string
  instance string
  sequence uint64
  ordinal  uint64
  bytes    int64
}

var lintTraceState struct {
  once   sync.Once
  writer *lintTraceWriter
}

// lintTraceInvocation correlates actual observations of one loader invocation.
// It is not serialized into a product result or cached configuration envelope.
//
// The short-lived reference links process, raw bytes, normalization and cache
// observations without retaining their history or owning the child process.
type lintTraceInvocation struct {
  writer  *lintTraceWriter
  ordinal uint64
  id      string
}

// newLintTraceInvocation allocates identity only when the fixed external trace
// root is enabled. Invalid/unwritable setup leaves missing trace evidence for
// the coordinator; it cannot turn into a successful product observation.
//
// Native absolute-path validation and nonce initialization happen once for the
// fixed marker; later identities use a mutex-protected ordinal. Unset activation
// reads only the marker and performs no filesystem IO or writer allocation.
func newLintTraceInvocation() *lintTraceInvocation {
  if os.Getenv("TTSC_E2E_TRACE") == "" {
    return nil
  }
  lintTraceState.once.Do(func() {
    root := os.Getenv("TTSC_E2E_TRACE")
    if !filepath.IsAbs(root) {
      return
    }
    info, err := os.Stat(root)
    if err != nil || !info.IsDir() {
      return
    }
    var nonce [16]byte
    if _, err := rand.Read(nonce[:]); err != nil {
      return
    }
    lintTraceState.writer = &lintTraceWriter{root: root, instance: hex.EncodeToString(nonce[:])}
  })
  writer := lintTraceState.writer
  if writer == nil {
    return nil
  }
  writer.mu.Lock()
  writer.ordinal++
  ordinal := writer.ordinal
  writer.mu.Unlock()
  return &lintTraceInvocation{
    writer:  writer,
    ordinal: ordinal,
    id:      fmt.Sprintf("%s:%d", writer.instance, ordinal),
  }
}

// record writes one actual event without returning a product error or emitting
// into protocol streams. Missing/partial events remain measurement failures.
// No actual process start or exit is inferred from an arbitrary caller event.
//
// Encoding/append cost scales with event bytes. The 256MiB total includes raw
// payloads and all events; no event history or open handle is retained. Filenames
// contain only the writer PID and nonce, never source-path components.
func (invocation *lintTraceInvocation) record(event string, data map[string]any) {
  if invocation == nil {
    return
  }
  writer := invocation.writer
  writer.mu.Lock()
  failure := ""
  defer func() {
    writer.mu.Unlock()
    if failure != "" && event != "trace-integrity-failure" {
      invocation.record("trace-integrity-failure", map[string]any{
        "operation": "event-append", "failedEvent": event, "error": failure,
      })
    }
  }()
  writer.sequence++
  pid := any(os.Getpid())
  if actual, exists := data["pid"]; exists {
    pid = actual
  }
  observedData := make(map[string]any, len(data)+1)
  for key, value := range data {
    observedData[key] = value
  }
  observedData["writerRuntime"] = runtime.Version()
  body, err := json.Marshal(map[string]any{
    "schema":     1,
    "event":      event,
    "writerPid":  os.Getpid(),
    "instance":   writer.instance,
    "sequence":   writer.sequence,
    "at":         time.Now().UTC().Format(time.RFC3339Nano),
    "invocation": invocation.id,
    "pid":        pid,
    "data":       observedData,
  })
  if err != nil {
    failure = err.Error()
    return
  }
  if int64(len(body))+1 > 256<<20-writer.bytes {
    failure = "writer output budget exceeded"
    return
  }
  body = append(body, '\n')
  filename := fmt.Sprintf("%d-%s.jsonl", os.Getpid(), writer.instance)
  file, err := os.OpenFile(filepath.Join(writer.root, filename), os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0600)
  if err != nil {
    failure = err.Error()
    return
  }
  n, writeErr := file.Write(body)
  writer.bytes += int64(n)
  closeErr := file.Close()
  if writeErr != nil || n != len(body) || closeErr != nil {
    failure = fmt.Sprintf("written=%d want=%d write=%v close=%v", n, len(body), writeErr, closeErr)
  }
}

// capture retains exactly the already-read bytes, never reconstructed JSON.
// Only helper-defined labels may be supplied. A partial write or budget refusal
// is returned as explicit integrity metadata, never as a complete oracle.
//
// Exclusive create prevents replacement of earlier evidence. A full write and
// successful close are required for complete status. One write scales with the
// original byte length, capped at 64MiB per payload and 256MiB per writer; a
// refused or incomplete capture is retained as failure metadata.
func (invocation *lintTraceInvocation) capture(label string, body []byte) map[string]any {
  if invocation == nil {
    return nil
  }
  metadata := map[string]any{"length": len(body), "outcome": "absent"}
  if body == nil {
    return metadata
  }
  writer := invocation.writer
  writer.mu.Lock()
  defer func() {
    writer.mu.Unlock()
    if metadata["outcome"] == "too-large" || metadata["outcome"] == "IO-failed" {
      invocation.record("trace-integrity-failure", map[string]any{
        "operation": "payload-capture", "payload": metadata,
      })
    }
  }()
  if len(body) > 64<<20 || int64(len(body)) > 256<<20-writer.bytes {
    metadata["outcome"] = "too-large"
    return metadata
  }
  filename := fmt.Sprintf("%d-%s-%d-%s.bin", os.Getpid(), writer.instance, invocation.ordinal, label)
  metadata["path"] = filename
  file, err := os.OpenFile(filepath.Join(writer.root, filename), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
  if err != nil {
    metadata["outcome"] = "IO-failed"
    metadata["error"] = err.Error()
    return metadata
  }
  n, writeErr := file.Write(body)
  writer.bytes += int64(n)
  closeErr := file.Close()
  if writeErr != nil || n != len(body) || closeErr != nil {
    metadata["outcome"] = "IO-failed"
    metadata["written"] = n
    metadata["error"] = fmt.Sprintf("write=%v close=%v", writeErr, closeErr)
    return metadata
  }
  metadata["outcome"] = "complete"
  return metadata
}
