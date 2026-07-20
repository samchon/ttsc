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

// TestLSPCleanDidOpenRefreshesCompilerState verifies that opening a document
// whose buffer already matches disk refreshes both compiler-backed caches, while
// opening a dirty buffer still refreshes neither.
//
// The resident lint Program and the graph symbol provider stay warm for the
// whole editor session, and before this only didSave refreshed them. A document
// closed across a branch switch, a `git pull`, or an edit from a second editor
// therefore came back with diagnostics computed over the pre-change AST and
// published against the new buffer. Equality with today's disk is not evidence
// that the warm Program was built from today's disk, so the clean branch is
// exactly the branch that must invalidate — and the dirty branch, which reports
// nothing at all until the buffer reaches disk, must keep not invalidating.
//
//  1. Write a file, open it with the same text, and assert both caches were
//     refreshed and the resident refresh named that document's URI.
//  2. Open a second file with text that differs from disk.
//  3. Assert neither cache was refreshed and the notification still forwards.
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
