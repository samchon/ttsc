package lspserver

import (
  "encoding/json"
  "io"
  "testing"
)

// watchedFilesSource records resident invalidations for the watched-file matrix.
type watchedFilesSource struct {
  NullPluginSource
  calls [][]string
}

func (s *watchedFilesSource) InvalidateResidentPrograms(uris ...string) {
  s.calls = append(s.calls, append([]string(nil), uris...))
}

type watchedFilesSymbolProvider struct{ invalidations int }

func (p *watchedFilesSymbolProvider) DocumentSymbols(string) ([]LSPDocumentSymbol, error) {
  return nil, nil
}

func (p *watchedFilesSymbolProvider) References(string, LSPPosition, bool) ([]LSPLocation, error) {
  return nil, nil
}

func (p *watchedFilesSymbolProvider) Invalidate() { p.invalidations++ }

func watchedFilesEnvelope(t *testing.T, params string) Envelope {
  t.Helper()
  if !json.Valid([]byte(params)) {
    t.Fatalf("invalid watched-file params: %s", params)
  }
  return Envelope{
    JSONRPC: "2.0",
    Method:  methodDidChangeWatchedFiles,
    Params:  json.RawMessage(params),
  }
}

// TestLSPWatchedFileChangesReachCompilerCaches verifies that a
// workspace/didChangeWatchedFiles batch refreshes both compiler-backed caches,
// and that only a plain edit to a plain source file is refreshed incrementally.
//
// The repository's VS Code client watches `**/{tsconfig,jsconfig}*.json`, which
// its documentSelector excludes, so a config edit can reach ttsc through no other
// notification; before this the proxy had no arm for the method at all and the
// sidecar's documented full-reload fallback was unreachable. A created or deleted
// file and a config edit each reshape the root set or the compiler options, which
// tsgo's per-file UpdateProgram cannot express, so they must drop the warm
// Program rather than update it.
//
//  1. Send a `changed` event for one ordinary source file and assert the resident
//     refresh carries exactly that URI.
//  2. Send a tsconfig edit, a created file, and a deleted file, and assert each
//     drops the whole Program instead.
//  3. Send an undecodable batch (full reload) and an empty batch (no-op).
func TestLSPWatchedFileChangesReachCompilerCaches(t *testing.T) {
  cases := []struct {
    name    string
    params  string
    wantRes [][]string
    wantSym int
  }{
    {
      name:    "changed source file is localized",
      params:  `{"changes":[{"uri":"file:///project/src/main.ts","type":2}]}`,
      wantRes: [][]string{{"file:///project/src/main.ts"}},
      wantSym: 1,
    },
    {
      name:    "several changed source files are localized together",
      params:  `{"changes":[{"uri":"file:///project/a.ts","type":2},{"uri":"file:///project/b.ts","type":2}]}`,
      wantRes: [][]string{{"file:///project/a.ts", "file:///project/b.ts"}},
      wantSym: 1,
    },
    {
      name:    "tsconfig edit drops the whole program",
      params:  `{"changes":[{"uri":"file:///project/tsconfig.json","type":2}]}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "scoped tsconfig edit drops the whole program",
      params:  `{"changes":[{"uri":"file:///project/tsconfig.build.json","type":2}]}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "jsconfig edit drops the whole program",
      params:  `{"changes":[{"uri":"file:///project/jsconfig.json","type":2}]}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "created file drops the whole program",
      params:  `{"changes":[{"uri":"file:///project/src/added.ts","type":1}]}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "deleted file drops the whole program",
      params:  `{"changes":[{"uri":"file:///project/src/gone.ts","type":3}]}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "one unlocalizable entry drops the whole batch",
      params:  `{"changes":[{"uri":"file:///project/a.ts","type":2},{"uri":"file:///project/tsconfig.json","type":2}]}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "a change with no type is not localizable",
      params:  `{"changes":[{"uri":"file:///project/a.ts"}]}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "an undecodable batch drops the whole program",
      params:  `{"changes":"not-an-array"}`,
      wantRes: [][]string{{}},
      wantSym: 1,
    },
    {
      name:    "an empty batch keeps every warm program",
      params:  `{"changes":[]}`,
      wantRes: nil,
      wantSym: 0,
    },
  }

  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      plugins := &watchedFilesSource{}
      symbols := &watchedFilesSymbolProvider{}
      proxy := NewProxy(ProxyOptions{
        EditorOut:      io.Discard,
        UpstreamIn:     io.Discard,
        Source:         plugins,
        SymbolProvider: symbols,
      })
      handled, err := proxy.handleEditorEnvelope(watchedFilesEnvelope(t, testCase.params), nil)
      if err != nil {
        t.Fatalf("watched-file notification: %v", err)
      }
      if handled {
        t.Fatal("watched-file notification was swallowed instead of forwarded to tsgo")
      }
      if symbols.invalidations != testCase.wantSym {
        t.Errorf("symbol invalidations = %d, want %d", symbols.invalidations, testCase.wantSym)
      }
      if len(plugins.calls) != len(testCase.wantRes) {
        t.Fatalf("resident invalidations = %v, want %v", plugins.calls, testCase.wantRes)
      }
      for index, want := range testCase.wantRes {
        got := plugins.calls[index]
        if len(got) != len(want) {
          t.Fatalf("resident invalidation %d = %v, want %v", index, got, want)
        }
        for position := range want {
          if got[position] != want[position] {
            t.Errorf("resident invalidation %d = %v, want %v", index, got, want)
            break
          }
        }
      }
    })
  }
}
