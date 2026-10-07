package lspserver

import (
  "os/exec"
  "testing"
)

// TestLSPDocumentDiagnosticsOmitsCachedProjectWhenCurrentResultHasNone
// verifies last-good cache state is not presented as a current document-cycle
// project result.
//
// A selected binary that cannot be resolved prevents current publication.
// The result must omit Project while the separately queried snapshot retains
// the seeded diagnostic code. This unit does not exercise JSON parse failure,
// successful publication, a proxy refresh or every cached publication field.
//
//  1. Seed one producer's last-good project publication.
//  2. Make the current document diagnostic invocation fail before publication.
//  3. Assert document diagnostics omit Project while one stale-coded cache entry remains.
//
// @evidence contracts/testing.md#behavioral-verification When the unresolved producer cannot publish a current result, actual Diagnostics returns Project=nil while the separately queried cache snapshot is nonnil and contains exactly one diagnostic with literal code stale. Other cached fields and successful/parse-failure publications are not asserted.
// @evidence contracts/testing.md#independent-expectations Absent Project, nonnil snapshot, one cached diagnostic and its code stale are independent literal state checks.
// @evidence contracts/testing.md#distinguishing-cases The failing run and the seeded cache are the two states that a stale-cache return would conflate.
// @evidence contracts/testing.md#execution-ownership This Go unit seeds the actual NativePluginSource cache and calls actual Diagnostics and projectDiagnosticsSnapshot. A native LookPath premise requires its supplied binary to be unresolvable before Diagnostics attempts the resident and one-shot command paths; no sidecar is installed or successfully started, and no temporary directory or substituted query operation exists. The asserted cache fields are nonnil snapshot, one entry and literal code stale; selected runtime execution remains unverified.
func TestLSPDocumentDiagnosticsOmitsCachedProjectWhenCurrentResultHasNone(
  t *testing.T,
) {
  plugin := NativeLSPPluginEntry{
    Binary: "ttsc-no-such-document-diagnostics-sidecar",
    Name:   "@ttsc/cached",
  }
  if _, err := exec.LookPath(plugin.Binary); err == nil {
    t.Fatalf("missing sidecar premise failed: %q resolves to an executable", plugin.Binary)
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
