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
// direct workspace/didChangeWatchedFiles dispatch selects invalidation calls.
//
// Owned optional source/provider implementations record invalidation arguments
// and counts. No actual compiler cache, Program, editor watch registration or
// upstream forwarding runs here; empty URI calls represent full invalidation
// requests rather than an observed Program being dropped.
//
//  1. Send a `changed` event for one ordinary source file and assert the resident
//     refresh carries exactly that URI.
//  2. Send a tsconfig edit, a created file, and a deleted file, and assert each
//     requests invalidation with an empty URI list instead.
//  3. Send an undecodable batch (full reload) and an empty batch (no-op).
//
// @evidence contracts/testing.md#behavioral-verification Direct dispatch over eleven authored batches records symbol-provider invalidation counts and exact source invalidation URI lists: ordinary edits are localized, config/topology/unlocalizable batches request an empty list, and an empty batch makes neither call. handled=false permits forwarding but does not execute it.
// @evidence contracts/testing.md#independent-expectations Expected refresh payloads are literal URIs and drop decisions.
// @evidence contracts/testing.md#distinguishing-cases Single/multiple source edits, tsconfig/scoped-tsconfig/jsconfig, creation/deletion, mixed config-source, absent type, undecodable changes and empty changes are individually named cases. The expected localized/empty/no-call requests differ; actual downstream cache transitions are outside this unit.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit's named subtests call actual Proxy dispatch with owned optional invalidator/provider recorders and io.Discard streams. It uses no foreign-method replacement, native process, temporary project, installed consumer or running product host.
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
