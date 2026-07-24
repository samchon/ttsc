package lspserver

import "testing"

// TestLSPProjectDiagnosticsRefreshKeepsEachProducerLastGood verifies partial
// refreshes update only the producers that answered successfully.
//
// Project diagnostics are one merged config-URI publication, but their
// sidecars fail independently. Rebuilding that publication from only the
// current call's successes would erase a failed producer's prior findings. An
// empty successful answer is different: it deliberately clears that producer.
//
//  1. Seed two producers with successful publications.
//  2. Refresh only the first and assert the second producer's last-good remains.
//  3. Clear the second with a successful empty publication.
//  4. Recover the second and assert manifest-order aggregation is restored.
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
