package lspserver

import "testing"

// TestLSPDocumentDiagnosticsOmitsCachedProjectWhenCurrentResultHasNone
// verifies last-good cache state is not presented as a current document-cycle
// project result.
//
// A parse failure can make lsp-diagnostics omit project data. Returning the
// prior cache in that response lets the proxy complete a newer pending external
// refresh with stale evidence.
//
//  1. Seed one producer's last-good project publication.
//  2. Make the current document diagnostic invocation fail before publication.
//  3. Assert document diagnostics omit Project while the cache remains intact.
//
// @evidence contracts/testing.md#behavioral-verification When the current document diagnostic invocation fails before publication the result omits Project while the producer's last-good cache stays intact.
// @evidence contracts/testing.md#independent-expectations The expected absent Project and retained cache are literal state checks.
// @evidence contracts/testing.md#distinguishing-cases The failing run and the seeded cache are the two states that a stale-cache return would conflate.
// @evidence contracts/testing.md#execution-ownership TestLSPDocumentDiagnosticsOmitsCachedProjectWhenCurrentResultHasNone is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPDocumentDiagnosticsOmitsCachedProjectWhenCurrentResultHasNone(
  t *testing.T,
) {
  plugin := NativeLSPPluginEntry{
    Binary: "ttsc-no-such-document-diagnostics-sidecar",
    Name:   "@ttsc/cached",
  }
  source := &NativePluginSource{plugins: []NativeLSPPluginEntry{plugin}}
  source.storeProjectDiagnostics(
    plugin,
    1,
    &LSPProjectDiagnostics{
      URI: "file:///project/tsconfig.json",
      Diagnostics: []LSPDiagnostic{{
        Code:    "stale",
        Message: "stale",
      }},
    },
  )

  got := source.Diagnostics(LSPDocumentVersion{
    URI: "file:///project/src/main.ts",
  })

  if got.Project != nil {
    t.Fatalf("current omitted project result reused cache: %#v", got.Project)
  }
  cached := source.projectDiagnosticsSnapshot()
  if cached == nil || len(cached.Diagnostics) != 1 ||
    cached.Diagnostics[0].Code != "stale" {
    t.Fatalf("last-good cache was not retained: %#v", cached)
  }
}
