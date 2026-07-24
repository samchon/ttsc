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
