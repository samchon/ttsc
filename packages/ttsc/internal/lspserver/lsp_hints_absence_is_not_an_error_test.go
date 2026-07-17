package lspserver

import (
  "bytes"
  "testing"
)

// TestLSPHintsAbsenceIsNotAnError pins that a plugin without the hint verb is
// silent, not broken.
//
// Every plugin built before this channel existed rejects `lsp-hints` as an
// unknown command, and that is permanent and universal rather than a
// transitional state. Treating it as a discovery failure would print an error
// per plugin per editor session, forever, for a feature those plugins were never
// asked to provide. It is the optional-interface reasoning applied to the wire:
// absence is an answer.
//
// A real sidecar that cannot run reaches the same path as one that rejects the
// verb — both return an error from run — so an unresolvable binary is a faithful
// stand-in and keeps the test from needing a compiled fixture.
//
//  1. Discover hints from a plugin whose sidecar cannot answer.
//  2. Assert the corpus is empty.
//  3. Assert nothing was written to the log.
func TestLSPHintsAbsenceIsNotAnError(t *testing.T) {
  var log bytes.Buffer
  source := &NativePluginSource{
    err: &log,
    plugins: []NativeLSPPluginEntry{
      {Binary: "ttsc-no-such-plugin-binary", Name: "@ttsc/legacy"},
    },
  }

  source.discoverCompletionHints()

  if hints := source.CompletionHints(); len(hints) != 0 {
    t.Errorf("a plugin that could not answer contributed %d hints", len(hints))
  }
  if log.Len() != 0 {
    t.Errorf(
      "a plugin without the hint verb was logged as a failure:\n%s\n"+
        "every plugin predating this channel would print that every session",
      log.String(),
    )
  }
}
