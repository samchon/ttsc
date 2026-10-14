package main

import (
  "bytes"
  "crypto/sha256"
  "encoding/base64"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCacheProtocol verifies the Go 1.26 request framing and response contract.
//
// Verifies: the helper advertises capabilities, echoes IDs, returns local hits and misses, writes a bounded usage receipt, and refuses malformed body transport.
// 1. Send real Go-style request headers and separate base64 body values through the in-process server.
// 2. Read every response and compare IDs, capabilities, paths and body metadata.
// 3. Break JSON, base64 and body framing independently and require terminal failure.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production protocol loop against an actual temporary store, parses its public JSON responses and reads the post-close local usage receipt.
// @evidence contracts/testing.md#independent-expectations The Go 1.26 cacheprog Request and Response fields, the extra request separator, and SHA-256 of literal bytes define expected framing and identities.
// @evidence contracts/testing.md#distinguishing-cases Covers startup, two misses, a large put/hit, empty body, unknown command, close, malformed JSON, bad base64 and truncated body; stock Go subprocess interoperability is a separate installed-boundary check.
// @evidence contracts/testing.md#execution-ownership This Go unit test calls serve directly without compiling a helper or launching a Go client; each case owns a temporary store.
func TestCacheProtocol(t *testing.T) {
  action := bytes.Repeat([]byte{0x1a}, 32)
  missing := bytes.Repeat([]byte{0x2b}, 32)
  body := bytes.Repeat([]byte("archive-data-"), 350000)
  outputID := sha256.Sum256(body)
  emptyID := sha256.Sum256(nil)
  requestLine := func(id int64, command string, key, output []byte, size int64) string {
    encoded, err := json.Marshal(request{ID: id, Command: command, ActionID: key, OutputID: output, BodySize: size})
    if err != nil {
      t.Fatal(err)
    }
    return string(encoded) + "\n\n"
  }
  input := requestLine(1, "get", missing, nil, 0) +
    requestLine(2, "put", action, outputID[:], int64(len(body))) +
    "\"" + base64.StdEncoding.EncodeToString(body) + "\"\n" +
    requestLine(3, "get", action, nil, 0) +
    requestLine(4, "get", missing, nil, 0) +
    requestLine(5, "put", missing, emptyID[:], 0) +
    requestLine(6, "get", missing, nil, 0) +
    requestLine(7, "future", nil, nil, 0) +
    requestLine(8, "close", nil, nil, 0)
  store, err := openArtifactStore(t.TempDir(), nil)
  if err != nil {
    t.Fatal(err)
  }
  defer store.close()
  store.receiptName = strings.Repeat("a", 32)
  var output bytes.Buffer
  if err := serve(strings.NewReader(input), &output, store); err != nil {
    t.Fatal(err)
  }
  lines := strings.Split(strings.TrimSpace(output.String()), "\n")
  if len(lines) != 9 {
    t.Fatalf("expected startup and eight responses, got %d", len(lines))
  }
  responses := make([]response, len(lines))
  for i, line := range lines {
    if err := json.Unmarshal([]byte(line), &responses[i]); err != nil {
      t.Fatal(err)
    }
  }
  if responses[0].ID != 0 || fmt.Sprint(responses[0].KnownCommands) != "[get put close]" {
    t.Fatalf("incorrect startup capabilities: %+v", responses[0])
  }
  for i := 1; i < len(responses); i++ {
    if responses[i].ID != int64(i) {
      t.Fatalf("response %d lost request ID: %+v", i, responses[i])
    }
  }
  if !responses[1].Miss || !responses[4].Miss || responses[2].DiskPath == "" || responses[3].DiskPath != responses[2].DiskPath || responses[3].Size != int64(len(body)) || !bytes.Equal(responses[3].OutputID, outputID[:]) {
    t.Fatalf("large body get/put contract failed: %+v", responses)
  }
  if responses[5].DiskPath == "" || responses[6].DiskPath != responses[5].DiskPath || !bytes.Equal(responses[6].OutputID, emptyID[:]) || responses[7].Err == "" || responses[8].Err != "" {
    t.Fatalf("empty body, unknown command or close contract failed: %+v", responses)
  }
  receiptRaw, err := os.ReadFile(filepath.Join(store.path, "receipts", store.receiptName))
  if err != nil {
    t.Fatal(err)
  }
  if !bytes.Contains(receiptRaw, []byte(`"baseActionIDs":[]`)) {
    t.Fatalf("unused action identity list was not an empty JSON array: %s", receiptRaw)
  }
  var usage usageReceipt
  if err := json.Unmarshal(receiptRaw, &usage); err != nil {
    t.Fatal(err)
  }
  if usage.Gets != 4 || usage.OverlayHits != 2 || usage.BaseHits != 0 || usage.Misses != 2 || usage.Puts != 2 || usage.PutBytes != int64(len(body)) {
    t.Fatalf("usage receipt did not distinguish exact hits and misses: %+v", usage)
  }
  if usage.Storage == nil || usage.Storage.OverlayBytes < int64(len(body)) || usage.Storage.PinnedBytes < int64(len(body)) || usage.Storage.StagingBytes != 0 {
    t.Fatalf("usage receipt omitted settled storage populations: %+v", usage.Storage)
  }
  if usage.Truncated || len(usage.MissActionIDs) != 2 || len(usage.OverlayActionIDs) != 2 || len(usage.PutActionIDs) != 2 || usage.MissActionIDs[0] != fmt.Sprintf("%x", missing) || usage.OverlayActionIDs[0] != fmt.Sprintf("%x", action) || usage.PutActionIDs[0] != fmt.Sprintf("%x", action) {
    t.Fatalf("usage receipt lost full requested action identities: %+v", usage)
  }
  for name, malformed := range map[string]string{
    "json":      "{not json}\n",
    "base64":    requestLine(1, "put", action, outputID[:], 3) + "\"!!!\"\n",
    "truncated": requestLine(1, "put", action, outputID[:], 3) + "\"YQ==",
  } {
    t.Run(name, func(t *testing.T) {
      caseStore, err := openArtifactStore(t.TempDir(), nil)
      if err != nil {
        t.Fatal(err)
      }
      defer caseStore.close()
      var sink bytes.Buffer
      if err := serve(strings.NewReader(malformed), &sink, caseStore); err == nil {
        t.Fatal("malformed request was accepted")
      }
    })
  }
}
