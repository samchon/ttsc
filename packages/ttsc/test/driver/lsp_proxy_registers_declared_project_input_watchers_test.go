package driver_test

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "sync"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type projectInputRegistrationSource struct {
  stubSource
  mu       sync.Mutex
  snapshot driver.LSPProjectInputSnapshot
  observer func()
}

func (s *projectInputRegistrationSource) ProjectInputs() driver.LSPProjectInputSnapshot {
  s.mu.Lock()
  defer s.mu.Unlock()
  return driver.LSPProjectInputSnapshot{
    Root:  s.snapshot.Root,
    Files: append([]string(nil), s.snapshot.Files...),
    Globs: append([]string(nil), s.snapshot.Globs...),
  }
}

func (s *projectInputRegistrationSource) SetProjectInputsObserver(observer func()) {
  s.mu.Lock()
  s.observer = observer
  s.mu.Unlock()
}

func (s *projectInputRegistrationSource) publish(snapshot driver.LSPProjectInputSnapshot) {
  s.mu.Lock()
  s.snapshot = snapshot
  observer := s.observer
  s.mu.Unlock()
  if observer != nil {
    observer()
  }
}

type decodedDeclaredClientRequest struct {
  ID     json.RawMessage `json:"id"`
  Method string          `json:"method"`
  Params json.RawMessage `json:"params"`
}

// TestLSPProxyRegistersDeclaredProjectInputWatchers verifies the complete
// initialize/register/replace/unregister wire lifecycle.
func TestLSPProxyRegistersDeclaredProjectInputWatchers(t *testing.T) {
  root := t.TempDir()
  external := t.TempDir()
  source := &projectInputRegistrationSource{
    snapshot: driver.LSPProjectInputSnapshot{
      Root:  filepath.ToSlash(root),
      Files: []string{filepath.ToSlash(filepath.Join(external, "docs", "missing #1.md"))},
      Globs: []string{filepath.ToSlash(filepath.Join(root, "api", "**", "*.json"))},
    },
  }
  h := newProxyHarness(t, source)

  initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{"workspace":{"didChangeWatchedFiles":{"dynamicRegistration":true,"relativePatternSupport":true}}}}}`)
  h.sendEditor(initialize)
  if got := h.recvUpstream(); !bytes.Equal(got, initialize) {
    t.Fatalf("initialize changed upstream:\n%s", got)
  }
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{}}}`))
  _ = h.recvEditor()

  initialized := []byte(`{"jsonrpc":"2.0","method":"initialized","params":{}}`)
  h.sendEditor(initialized)
  if got := h.recvUpstream(); !bytes.Equal(got, initialized) {
    t.Fatalf("initialized changed upstream:\n%s", got)
  }
  first := decodeDeclaredClientRequest(t, h.recvEditor())
  if first.Method != "client/registerCapability" {
    t.Fatalf("first client request method = %q", first.Method)
  }
  assertProjectInputRegistrationPatterns(
    t,
    first.Params,
    map[string]string{
      "docs/missing #1.md": fileURIForPath(external),
      "api/**/*.json":      fileURIForPath(root),
    },
  )
  respondToClientRequest(t, h, first, nil)

  source.publish(driver.LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(root),
    Files: []string{filepath.ToSlash(filepath.Join(external, "docs", "next.md"))},
  })
  replacement := decodeDeclaredClientRequest(t, h.recvEditor())
  if replacement.Method != "client/registerCapability" {
    t.Fatalf("replacement method = %q", replacement.Method)
  }
  respondToClientRequest(t, h, replacement, nil)
  cleanup := decodeDeclaredClientRequest(t, h.recvEditor())
  if cleanup.Method != "client/unregisterCapability" {
    t.Fatalf("cleanup method = %q", cleanup.Method)
  }
  if !bytes.Contains(cleanup.Params, []byte(`"unregisterations"`)) {
    t.Fatalf("cleanup omitted LSP unregisterations field: %s", cleanup.Params)
  }
  respondToClientRequest(t, h, cleanup, nil)

  source.publish(driver.LSPProjectInputSnapshot{Root: filepath.ToSlash(root)})
  emptyCleanup := decodeDeclaredClientRequest(t, h.recvEditor())
  if emptyCleanup.Method != "client/unregisterCapability" {
    t.Fatalf("empty transition method = %q", emptyCleanup.Method)
  }
  respondToClientRequest(t, h, emptyCleanup, nil)

  unrelated := []byte(`{"jsonrpc":"2.0","id":"ts1","result":null}`)
  h.sendEditor(unrelated)
  if got := h.recvUpstream(); !bytes.Equal(got, unrelated) {
    t.Fatalf("unrelated upstream response changed:\n%s", got)
  }
}

// TestLSPProxyWarnsWhenRelativeWatcherRegistrationIsUnsupported verifies the
// proxy does not pretend a partial in-project watcher covers external inputs.
func TestLSPProxyWarnsWhenRelativeWatcherRegistrationIsUnsupported(t *testing.T) {
  root := t.TempDir()
  external := t.TempDir()
  source := &projectInputRegistrationSource{
    snapshot: driver.LSPProjectInputSnapshot{
      Root:  filepath.ToSlash(root),
      Files: []string{filepath.ToSlash(filepath.Join(external, "docs", "spec.md"))},
    },
  }
  h := newProxyHarness(t, source)

  initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{"workspace":{"didChangeWatchedFiles":{"dynamicRegistration":true,"relativePatternSupport":false}}}}}`)
  h.sendEditor(initialize)
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{}}}`))
  _ = h.recvEditor()
  initialized := []byte(`{"jsonrpc":"2.0","method":"initialized","params":{}}`)
  h.sendEditor(initialized)
  _ = h.recvUpstream()
  notice := h.recvEditor()
  if !bytes.Contains(notice, []byte(`"window/logMessage"`)) ||
    !bytes.Contains(notice, []byte(`dynamic relative file-pattern`)) {
    t.Fatalf("unsupported client notice = %s", notice)
  }
  h.expectNoEditorFrame(100 * time.Millisecond)
}

func decodeDeclaredClientRequest(
  t *testing.T,
  body []byte,
) decodedDeclaredClientRequest {
  t.Helper()
  var request decodedDeclaredClientRequest
  if err := json.Unmarshal(body, &request); err != nil {
    t.Fatalf("decode client request: %v\n%s", err, body)
  }
  return request
}

func respondToClientRequest(
  t *testing.T,
  h *proxyHarness,
  request decodedDeclaredClientRequest,
  responseError any,
) {
  t.Helper()
  response := map[string]any{
    "jsonrpc": "2.0",
    "id":      request.ID,
    "result":  nil,
  }
  if responseError != nil {
    delete(response, "result")
    response["error"] = responseError
  }
  body, err := json.Marshal(response)
  if err != nil {
    t.Fatal(err)
  }
  h.sendEditor(body)
}

func assertProjectInputRegistrationPatterns(
  t *testing.T,
  params json.RawMessage,
  expected map[string]string,
) {
  t.Helper()
  var decoded struct {
    Registrations []struct {
      RegisterOptions struct {
        Watchers []struct {
          GlobPattern struct {
            BaseURI string `json:"baseUri"`
            Pattern string `json:"pattern"`
          } `json:"globPattern"`
          Kind int `json:"kind"`
        } `json:"watchers"`
      } `json:"registerOptions"`
    } `json:"registrations"`
  }
  if err := json.Unmarshal(params, &decoded); err != nil {
    t.Fatal(err)
  }
  if len(decoded.Registrations) != 1 {
    t.Fatalf("registrations = %#v", decoded.Registrations)
  }
  got := map[string]string{}
  for _, watcher := range decoded.Registrations[0].RegisterOptions.Watchers {
    if watcher.Kind != 7 {
      t.Fatalf("watcher kind = %d", watcher.Kind)
    }
    got[watcher.GlobPattern.Pattern] = watcher.GlobPattern.BaseURI
  }
  if len(got) != len(expected) {
    t.Fatalf("watcher patterns = %#v, want %#v", got, expected)
  }
  for pattern, baseURI := range expected {
    if got[pattern] != baseURI {
      t.Fatalf("watcher %q base = %q, want %q", pattern, got[pattern], baseURI)
    }
  }
}
