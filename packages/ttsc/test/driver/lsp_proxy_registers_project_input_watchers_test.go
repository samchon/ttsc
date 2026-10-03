package driver_test

import (
  "encoding/json"
  "path/filepath"
  "sync"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type dynamicProjectInputSource struct {
  stubSource

  mu       sync.Mutex
  observer func()
  snapshot driver.LSPProjectInputSnapshot
}

func (s *dynamicProjectInputSource) SetProjectInputsObserver(observer func()) {
  s.mu.Lock()
  s.observer = observer
  s.mu.Unlock()
}

func (s *dynamicProjectInputSource) ProjectInputs() driver.LSPProjectInputSnapshot {
  s.mu.Lock()
  defer s.mu.Unlock()
  return s.snapshot
}

func (s *dynamicProjectInputSource) replace(snapshot driver.LSPProjectInputSnapshot) {
  s.mu.Lock()
  s.snapshot = snapshot
  observer := s.observer
  s.mu.Unlock()
  if observer != nil {
    observer()
  }
}

// TestLSPProxyRegistersProjectInputWatchers Verifies registration replacement and stale cleanup requests.
//
// A mutable project-input source drives the proxy registration handshake. The
// assertions check request methods, distinct replacement request ids and one
// nonempty stale registration id; they do not inspect the registered patterns.
//
// 1. Initialize dynamic RelativePattern support and acknowledge registration.
// 2. Replace exact-file inputs with a glob snapshot and acknowledge its successor.
// 3. Require a stale unregistration request and acknowledge its nonempty id.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run sends initial and replacement registration requests with distinct ids, then a nonempty stale unregistration after acknowledgments.
// @evidence contracts/testing.md#independent-expectations Dynamic watched-file registrations require successor identity and stale cleanup; client/registerCapability and client/unregisterCapability methods supply the wire expectations.
// @evidence contracts/testing.md#distinguishing-cases An exact-file snapshot changes to a glob snapshot after initialized; the body does not inspect pattern payloads or prove which registration id was removed.
// @evidence contracts/testing.md#execution-ownership Go test/driver runs the pipe proxy with a mutable project-input source and simulated client acknowledgments, without a filesystem watcher or editor process.
func TestLSPProxyRegistersProjectInputWatchers(t *testing.T) {
  root := t.TempDir()
  source := &dynamicProjectInputSource{
    snapshot: driver.LSPProjectInputSnapshot{
      Root:  filepath.ToSlash(root),
      Files: []string{filepath.ToSlash(filepath.Join(root, "docs", "spec.md"))},
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{"workspace":{"didChangeWatchedFiles":{"dynamicRegistration":true,"relativePatternSupport":true}}}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{}}}`))
  _ = h.recvEditor()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"initialized","params":{}}`))
  _ = h.recvUpstream()

  first := decodeClientRequest(t, h.recvEditor(), "client/registerCapability")
  acknowledgeClientRequest(t, h, first.ID)

  source.replace(driver.LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(root),
    Globs: []string{filepath.ToSlash(filepath.Join(root, "api", "**", "*.json"))},
  })
  second := decodeClientRequest(t, h.recvEditor(), "client/registerCapability")
  if string(second.ID) == string(first.ID) {
    t.Fatal("replacement registration reused the prior request id")
  }
  acknowledgeClientRequest(t, h, second.ID)

  stale := decodeClientRequest(t, h.recvEditor(), "client/unregisterCapability")
  var params struct {
    Unregisterations []struct {
      ID string `json:"id"`
    } `json:"unregisterations"`
  }
  if err := json.Unmarshal(stale.Params, &params); err != nil {
    t.Fatal(err)
  }
  if len(params.Unregisterations) != 1 ||
    params.Unregisterations[0].ID == "" {
    t.Fatalf("stale unregistration = %#v", params)
  }
  acknowledgeClientRequest(t, h, stale.ID)
}

type decodedClientRequest struct {
  ID     json.RawMessage
  Params json.RawMessage
}

func decodeClientRequest(
  t *testing.T,
  body []byte,
  wantMethod string,
) decodedClientRequest {
  t.Helper()
  var envelope struct {
    ID     json.RawMessage `json:"id"`
    Method string          `json:"method"`
    Params json.RawMessage `json:"params"`
  }
  if err := json.Unmarshal(body, &envelope); err != nil {
    t.Fatalf("decode client request: %v\n%s", err, body)
  }
  if envelope.Method != wantMethod || len(envelope.ID) == 0 {
    t.Fatalf("client request = %#v, want method %q", envelope, wantMethod)
  }
  return decodedClientRequest{ID: envelope.ID, Params: envelope.Params}
}

func acknowledgeClientRequest(
  t *testing.T,
  h *proxyHarness,
  id json.RawMessage,
) {
  t.Helper()
  body, err := json.Marshal(map[string]any{
    "jsonrpc": "2.0",
    "id":      json.RawMessage(id),
    "result":  nil,
  })
  if err != nil {
    t.Fatal(err)
  }
  h.sendEditor(body)
}
