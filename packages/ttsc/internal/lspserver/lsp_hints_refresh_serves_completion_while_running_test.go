package lspserver

import (
  "sync"
  "testing"
)

// TestLSPHintsRefreshServesCompletionWhileRunning pins the reader's view during
// a refresh.
//
// Completion is answered from the corpus on the request path while a refresh
// writes it from a background goroutine, so this is a real concurrent
// reader/writer pair rather than a theoretical one — the user types while their
// save is still being re-indexed. Two failures hide here that a single-threaded
// test cannot see: a data race on the snapshot, and a reader catching the corpus
// mid-rebuild and offering a truncated list. Run with -race.
//
//  1. Seed two producers so a torn snapshot is distinguishable from a whole one.
//  2. Rewrite both producers' corpora repeatedly while readers ask for them.
//  3. Assert every snapshot a reader saw was a whole corpus of known hints.
func TestLSPHintsRefreshServesCompletionWhileRunning(t *testing.T) {
  first := NativeLSPPluginEntry{Binary: "ttsc-lint", Name: "@ttsc/lint"}
  second := NativeLSPPluginEntry{Binary: "ttsc-evidence", Name: "@samchon/evidence"}
  source := &NativePluginSource{plugins: []NativeLSPPluginEntry{first, second}}
  proxy := &Proxy{source: source}

  corpus := func(plugin NativeLSPPluginEntry, insert string) []LSPCompletionHint {
    after := "@"
    if plugin.Binary == second.Binary {
      after = "@evidence "
    }
    return []LSPCompletionHint{
      {Scope: "jsdoc", After: after, Items: []LSPCompletionItem{{Insert: insert}}},
    }
  }
  source.storeCompletionHints(first, 1, corpus(first, "param"))
  source.storeCompletionHints(second, 1, corpus(second, "docs/rfc.md"))

  const cycles = 200
  var writers sync.WaitGroup
  writers.Add(2)
  for _, plugin := range []NativeLSPPluginEntry{first, second} {
    go func(plugin NativeLSPPluginEntry) {
      defer writers.Done()
      for generation := uint64(2); generation < cycles; generation++ {
        source.storeCompletionHints(plugin, generation, corpus(plugin, "refreshed"))
      }
    }(plugin)
  }

  var readers sync.WaitGroup
  failures := make(chan string, 16)
  for reader := 0; reader < 4; reader++ {
    readers.Add(1)
    go func() {
      defer readers.Done()
      for i := 0; i < cycles; i++ {
        hints := proxy.pluginCompletionHints()
        if len(hints) != 2 {
          select {
          case failures <- "a completion request saw a partially rebuilt corpus":
          default:
          }
          return
        }
        if hints[0].After != "@" || hints[1].After != "@evidence " {
          select {
          case failures <- "a completion request saw producers out of manifest order":
          default:
          }
          return
        }
        for _, hint := range hints {
          if len(hint.Items) != 1 || hint.Items[0].Insert == "" {
            select {
            case failures <- "a completion request saw an empty hint group":
            default:
            }
            return
          }
        }
      }
    }()
  }
  writers.Wait()
  readers.Wait()
  close(failures)
  for failure := range failures {
    t.Error(failure)
  }
}
