package lspserver

import (
  "bytes"
  "testing"
)

// TestResidentFallsBackWhenServeUnsupported verifies a sidecar that cannot serve
// degrades to the spawn-per-verb path instead of losing the verb.
//
// Every sidecar built before lsp-serve rejects it, and a resident child can also
// fail to spawn; either way the read verb must still run. serveRun signals that
// by returning served=false so run() falls through to exec. It must also mark
// the binary unsupported after a first-spawn failure, or the source would
// spawn-and-fail per request forever.
//
// A binary that cannot be launched reaches the same spawn error as a sidecar
// that rejects the verb, so an unresolvable name is a faithful stand-in and
// keeps the test from needing a compiled fixture (mirrors the hint-absence
// test).
//
//  1. serveRun a read verb against a plugin whose binary cannot launch.
//  2. Assert it reports served=false (the caller falls back to exec).
//  3. Assert the binary is marked unsupported, and a second call short-circuits.
func TestResidentFallsBackWhenServeUnsupported(t *testing.T) {
  source := &NativePluginSource{err: &bytes.Buffer{}}
  plugin := NativeLSPPluginEntry{Binary: "ttsc-no-such-serve-binary", Name: "@ttsc/legacy"}

  if _, served, _ := source.serveRun(plugin, serveVerbDiagnostics, []string{"--uri=file:///a.ts"}); served {
    t.Fatal("a sidecar that cannot spawn must fall back to exec (served=false)")
  }

  source.residentMu.Lock()
  unsupported := source.serveUnsupported[pluginKey(plugin)]
  source.residentMu.Unlock()
  if !unsupported {
    t.Fatal("a first-spawn failure must mark lsp-serve unsupported so the source stops retrying")
  }

  if _, served, _ := source.serveRun(plugin, serveVerbDiagnostics, []string{"--uri=file:///a.ts"}); served {
    t.Fatal("a binary already marked unsupported must keep falling back")
  }
}
