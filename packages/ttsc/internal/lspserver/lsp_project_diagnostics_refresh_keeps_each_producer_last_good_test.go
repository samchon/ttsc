package lspserver

import "testing"

// TestLSPProjectDiagnosticsRefreshKeepsEachProducerLastGood verifies partial
// direct stores replace only their producer's retained diagnostic codes.
//
// Project diagnostics are one merged config-URI publication, but their
// sidecars fail independently. Rebuilding that publication from only the
// current call's successes would erase a failed producer's prior findings. An
// empty successful answer is different: it deliberately clears that producer.
//
//  1. Seed two retained publications through direct stores.
//  2. Store only the first again and assert the second remains.
//  3. Store an empty publication for the second, then another nonempty one.
//  4. Require literal code order at every snapshot stage.
//
// @evidence contracts/testing.md#behavioral-verification Actual direct stores and snapshots preserve the untouched second record, clear its codes with an empty publication, and restore its codes after a later store. The literal ordered code lists detect record loss or reordering; no producer query, failure or recovery is executed.
// @evidence contracts/testing.md#independent-expectations Expected ordered code lists are authored separately from the source's aggregation. The assertion selects diagnostic codes only, so it does not certify URI, message or other publication fields.
// @evidence contracts/testing.md#distinguishing-cases Initial two records, first-only replacement, second empty replacement and second nonempty replacement are the four direct-store stages. Failure is represented only by omitting a store, not by a failed native command.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly invokes NativePluginSource.storeProjectDiagnostics and projectDiagnosticsSnapshot with owned publication values. Binary names are opaque record identities: this body starts no child, installs no consumer and creates no temporary project or product host.
func TestLSPProjectDiagnosticsRefreshKeepsEachProducerLastGood(t *testing.T) {
  first := NativeLSPPluginEntry{Binary: "first", Name: "@ttsc/first"}
  second := NativeLSPPluginEntry{Binary: "second", Name: "@ttsc/second"}
  source := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first, second},
  }
  publication := func(codes ...string) *LSPProjectDiagnostics {
    diagnostics := make([]LSPDiagnostic, 0, len(codes))
    for _, code := range codes {
      diagnostics = append(diagnostics, LSPDiagnostic{
        Code:    code,
        Message: code,
      })
    }
    return &LSPProjectDiagnostics{
      URI:         "file:///project/tsconfig.json",
      Diagnostics: diagnostics,
    }
  }
  codes := func(got *LSPProjectDiagnostics) []string {
    if got == nil {
      return nil
    }
    out := make([]string, 0, len(got.Diagnostics))
    for _, diagnostic := range got.Diagnostics {
      out = append(out, diagnostic.Code.(string))
    }
    return out
  }
  assertCodes := func(label string, got *LSPProjectDiagnostics, want ...string) {
    t.Helper()
    actual := codes(got)
    if len(actual) != len(want) {
      t.Fatalf("%s codes = %v, want %v", label, actual, want)
    }
    for index := range want {
      if actual[index] != want[index] {
        t.Fatalf("%s codes = %v, want %v", label, actual, want)
      }
    }
  }

  source.storeProjectDiagnostics(first, 1, publication("first-old"))
  source.storeProjectDiagnostics(second, 1, publication("second-old"))
  assertCodes(
    "initial",
    source.projectDiagnosticsSnapshot(),
    "first-old",
    "second-old",
  )

  source.storeProjectDiagnostics(first, 2, publication("first-new"))
  assertCodes(
    "partial failure",
    source.projectDiagnosticsSnapshot(),
    "first-new",
    "second-old",
  )

  source.storeProjectDiagnostics(second, 3, publication())
  assertCodes(
    "successful clear",
    source.projectDiagnosticsSnapshot(),
    "first-new",
  )

  source.storeProjectDiagnostics(second, 4, publication("second-new"))
  assertCodes(
    "recovery",
    source.projectDiagnosticsSnapshot(),
    "first-new",
    "second-new",
  )
}
