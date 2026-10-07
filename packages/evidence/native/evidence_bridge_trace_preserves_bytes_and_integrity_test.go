package evidence

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "strconv"
  "testing"
)

/**
 * Verifies the private observer preserves raw bytes and reports capture limits.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual private capture/record writer over an owned scratch stream. Exact whitespace-bearing JSON bytes survive without reconstruction. The maintained limitedBuffer overflow keeps its original prefix/count/error and is captured as too-large; an occupied payload destination reports IO-failed. The authored near-budget boundary refuses even an empty payload and emits an integrity event.
 * @evidence contracts/testing.md#independent-expectations Literal bytes, a two-byte product buffer limit and an authored exhausted accounting state establish expectations independently of the trace output. The stream envelope must retain schema1, actual writer PID, fixture instance and core invocation native-unit:7; payload filenames retain ordinal7. No parser DTO is used as actual bridge proof, and the near-budget state is not a measured 256MiB stress run.
 * @evidence contracts/testing.md#distinguishing-cases Complete capture contrasts with product overflow, payload IO refusal and depleted writer budget. Empty bytes still cost one file identity, so exhausted accounting cannot create unlimited empty files. Actual command execution, lookup pairing, opt-in initialization, native/Node digest agreement and lifecycle joins remain E consumer contributions.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceBridgeTracePreservesBytesAndIntegrity is one selectable native Go entry with four synchronous named cases. Each directly owns a writer fixture and t.TempDir, calls maintained file/buffer operations in-process and parses the actual resulting event stream. It starts no Node child, product host, installation or build and changes no process-global trace/cache state. Runtime and actual E connection remain separate verification.
 */
func TestEvidenceBridgeTracePreservesBytesAndIntegrity(t *testing.T) {
  for _, name := range []string{"exact-raw-bytes", "product-overflow", "payload-IO-failure", "exhausted-empty-capture"} {
    t.Run(name, func(t *testing.T) {
      root := t.TempDir()
      path := filepath.Join(root, "events.jsonl")
      if err := os.WriteFile(path, nil, 0o600); err != nil {
        t.Fatal(err)
      }
      writer := &evidenceTraceWriter{directory: root, path: path, instance: "native-unit", pid: os.Getpid()}
      trace := &evidenceBridgeTrace{writer: writer, invocation: "7", kind: "prisma"}
      raw := []byte(" { \"z\": 1, \"a\": [true] }\n")
      productLimit := 64 * 1024 * 1024
      exceeded := false
      expected := "complete"
      switch name {
      case "product-overflow":
        buffer := &limitedBuffer{Limit: 2}
        count, err := buffer.Write([]byte("abcdef"))
        if count != 6 || err == nil || buffer.String() != "ab" || !buffer.Exceeded {
          t.Fatalf("product buffer must keep its original count/prefix/error: %d %v %q", count, err, buffer.String())
        }
        raw, productLimit, exceeded, expected = buffer.Bytes(), buffer.Limit, buffer.Exceeded, "too-large"
      case "payload-IO-failure":
        occupied := filepath.Join(root, strconv.Itoa(writer.pid)+"-native-unit-7-stdout.bin")
        if err := os.Mkdir(occupied, 0o700); err != nil {
          t.Fatal(err)
        }
        expected = "IO-failed"
      case "exhausted-empty-capture":
        writer.bytes = evidenceTraceLimit - evidenceTraceFailureReserve
        raw, expected = nil, "too-large"
      }
      metadata := trace.capture(raw, productLimit, exceeded)
      if metadata["capture"] != expected || metadata["observedByteLength"] != len(raw) {
        t.Fatalf("expected %s/%d, got %#v", expected, len(raw), metadata)
      }
      if name == "exact-raw-bytes" || name == "product-overflow" {
        relative, ok := metadata["path"].(string)
        if !ok {
          t.Fatalf("capture must name its actual payload: %#v", metadata)
        }
        observed, err := os.ReadFile(filepath.Join(root, relative))
        if err != nil || !bytes.Equal(observed, raw) {
          t.Fatalf("capture must preserve exact buffered bytes: %q, %v", observed, err)
        }
      }
      if name == "exact-raw-bytes" {
        trace.record("bridge-result", writer.pid, map[string]any{"stdout": metadata})
      }
      stream, err := os.ReadFile(path)
      if err != nil {
        t.Fatal(err)
      }
      lines := bytes.Split(bytes.TrimSpace(stream), []byte("\n"))
      if len(lines) != 1 || len(lines[0]) == 0 {
        t.Fatalf("one actual result or integrity event must be present: %q", stream)
      }
      var event struct {
        Schema     int    `json:"schema"`
        Event      string `json:"event"`
        WriterPID  int    `json:"writerPid"`
        Instance   string `json:"instance"`
        Invocation string `json:"invocation"`
      }
      if err := json.Unmarshal(lines[0], &event); err != nil {
        t.Fatal(err)
      }
      expectedEvent := "trace-integrity-failure"
      if name == "exact-raw-bytes" {
        expectedEvent = "bridge-result"
      }
      if event.Schema != 1 || event.Event != expectedEvent || event.WriterPID != writer.pid ||
        event.Instance != "native-unit" || event.Invocation != "native-unit:7" {
        t.Fatalf("the observed event must preserve its envelope and failure identity: %#v", event)
      }
      if writer.bytes > evidenceTraceLimit {
        t.Fatalf("accounting exceeded the complete writer budget: %d", writer.bytes)
      }
    })
  }
}
