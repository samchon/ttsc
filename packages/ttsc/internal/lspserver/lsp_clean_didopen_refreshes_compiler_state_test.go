package lspserver

import (
  "encoding/json"
  "io"
  "os"
  "path/filepath"
  "strings"
  "sync"
  "testing"
)

// recordingResidentSource is a PluginSource that also implements the resident
// invalidator, recording every InvalidateResidentPrograms call so a test can
// assert both that an invalidation happened and how it was localized.
//
// A clean open schedules its diagnostics on a goroutine that holds this same
// source, so the recording is mutex-guarded: the assertions below read it while
// that goroutine may still be running.
type recordingResidentSource struct {
  NullPluginSource
  mu    sync.Mutex
  calls [][]string
}

func (s *recordingResidentSource) InvalidateResidentPrograms(uris ...string) {
  s.mu.Lock()
  defer s.mu.Unlock()
  s.calls = append(s.calls, append([]string(nil), uris...))
}

func (s *recordingResidentSource) recorded() [][]string {
  s.mu.Lock()
  defer s.mu.Unlock()
  return append([][]string(nil), s.calls...)
}

// recordingSymbolProvider counts Invalidate calls; the two answer methods are
// never reached by these notification tests. Invalidate is only ever called from
// the notification path, which is the test's own goroutine.
type recordingSymbolProvider struct{ invalidations int }

func (p *recordingSymbolProvider) DocumentSymbols(string) ([]LSPDocumentSymbol, error) {
  return nil, nil
}

func (p *recordingSymbolProvider) References(string, LSPPosition, bool) ([]LSPLocation, error) {
  return nil, nil
}

func (p *recordingSymbolProvider) Invalidate() { p.invalidations++ }

// testFileURI renders an absolute path as the file URI an editor would send.
func testFileURI(path string) string {
  return "file:///" + strings.TrimPrefix(filepath.ToSlash(path), "/")
}

func didOpenEnvelope(uri string, text string) Envelope {
  params, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{
      "uri":        uri,
      "languageId": "typescript",
      "version":    1,
      "text":       text,
    },
  })
  return Envelope{JSONRPC: "2.0", Method: methodDidOpen, Params: params}
}

// TestLSPCleanDidOpenRefreshesCompilerState checks invalidation dispatch on
// directly supplied clean and dirty didOpen envelopes. The resident source and
// symbol provider are recording instances, not actual compiler-backed caches.
//
// Matching disk should dispatch one invalidation to each recording instance and
// name the clean URI; a dirty second file should not increase either count.
// Returning handled=false establishes eligibility for forwarding, not an actual
// upstream frame. Program freshness and published diagnostic content are not
// observed, and the scheduled NullPluginSource diagnostics are not joined here.
//
//  1. Write a file, open it with the same text, and assert both caches were
//     refreshed and the resident refresh named that document's URI.
//  2. Open a second file with text that differs from disk.
//  3. Assert neither recorder gained a call and the notification is not handled.
//
// @evidence contracts/testing.md#behavioral-verification A clean direct didOpen produces one recorded symbol invalidation and one resident invalidation naming its URI; a dirty second open preserves both counts. Both return handled=false. Actual compiler cache refresh, diagnostic content, upstream forwarding, and asynchronous completion are not asserted.
// @evidence contracts/testing.md#independent-expectations The refresh counts and the named URI are literal expectations for the two opened files.
// @evidence contracts/testing.md#distinguishing-cases Two owned files have the same disk bytes, but the clean buffer matches and the dirty buffer differs. They also have different URIs and run sequentially on one proxy; this is not a one-variable-only or reversed-order experiment.
// @evidence contracts/testing.md#execution-ownership Owns two temporary native files and a NewProxy with supported instance-owned recording PluginSource/SymbolProvider and io.Discard streams. Direct handleEditorEnvelope reads buffer/disk state and schedules NullPluginSource diagnostics on the clean branch; no join or diagnostics-result oracle is claimed. No actual compiler Program, sidecar, product CLI, installed consumer, or upstream server runs.
func TestLSPCleanDidOpenRefreshesCompilerState(t *testing.T) {
  dir := t.TempDir()
  clean := filepath.Join(dir, "clean.ts")
  if err := os.WriteFile(clean, []byte("export const value = 1;\n"), 0o600); err != nil {
    t.Fatalf("write clean source: %v", err)
  }
  cleanURI := testFileURI(clean)

  plugins := &recordingResidentSource{}
  symbols := &recordingSymbolProvider{}
  proxy := NewProxy(ProxyOptions{
    EditorOut:      io.Discard,
    UpstreamIn:     io.Discard,
    Source:         plugins,
    SymbolProvider: symbols,
  })

  handled, err := proxy.handleEditorEnvelope(
    didOpenEnvelope(cleanURI, "export const value = 1;\n"),
    nil,
  )
  if err != nil {
    t.Fatalf("clean didOpen: %v", err)
  }
  if handled {
    t.Fatal("clean didOpen was answered locally instead of forwarded to tsgo")
  }
  if symbols.invalidations != 1 {
    t.Errorf("clean didOpen symbol invalidations = %d, want 1", symbols.invalidations)
  }
  if len(plugins.recorded()) != 1 {
    t.Fatalf("clean didOpen resident invalidations = %d, want 1", len(plugins.recorded()))
  }
  if len(plugins.recorded()[0]) != 1 || plugins.recorded()[0][0] != cleanURI {
    t.Errorf("clean didOpen resident invalidation = %v, want the opened uri %q", plugins.recorded()[0], cleanURI)
  }

  dirty := filepath.Join(dir, "dirty.ts")
  if err := os.WriteFile(dirty, []byte("export const value = 1;\n"), 0o600); err != nil {
    t.Fatalf("write dirty source: %v", err)
  }
  handled, err = proxy.handleEditorEnvelope(
    didOpenEnvelope(testFileURI(dirty), "export const value = 2;\n"),
    nil,
  )
  if err != nil {
    t.Fatalf("dirty didOpen: %v", err)
  }
  if handled {
    t.Fatal("dirty didOpen was answered locally instead of forwarded to tsgo")
  }
  if symbols.invalidations != 1 {
    t.Errorf("dirty didOpen refreshed the symbol provider: invalidations = %d, want 1", symbols.invalidations)
  }
  if len(plugins.recorded()) != 1 {
    t.Errorf("dirty didOpen refreshed the resident daemon: calls = %v, want only the clean open's", plugins.recorded())
  }
}
