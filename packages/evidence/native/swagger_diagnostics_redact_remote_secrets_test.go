package evidence

import (
  "strings"
  "testing"
)

// TestSwaggerDiagnosticsRedactRemoteSecrets verifies configuration and source
// failures sanitize URL presentation while accepted identity stays unchanged.
//
// Parser and bridge reasons can repeat a URL or name a redirect. Sanitizing the
// source label alone does not protect these independently supplied strings.
//
// 1. Validate accepted and malformed URL rows and compare their diagnostics.
// 2. Format repeated external failures and retain meaningful cause/host/path.
// 3. Verify local errors and remote cache keys retain their original meaning.
//
// @evidence contracts/testing.md#behavioral-verification normalizeSwaggerSource, swaggerNormalizationFailure and displaySwaggerSource suppress literal credential/query/fragment sentinels across parser, missing-host and fragment failures; accepted spelling, local errors and remote cache identities remain exact.
// @evidence contracts/testing.md#independent-expectations Literal forbidden secrets and required cause/host/path substrings define the display contract, while exact input equality defines transport and cache identity independently of redaction implementation.
// @evidence contracts/testing.md#distinguishing-cases Valid, malformed, encoded, uppercase, missing-host, fragment and repeated redirect URL rows contrast with local filenames. Distinct query credentials cannot alias remote cache entries; cached rejection formatting uses the same safe boundary.
// @evidence contracts/testing.md#execution-ownership This selectable Go unit calls native configuration, presentation and cache operations directly. Named subtests collect independent rows without Node, a native producer or a product host, and isolateSwaggerCache restores shared cache state.
func TestSwaggerDiagnosticsRedactRemoteSecrets(t *testing.T) {
  isolateSwaggerCache(t)
  secrets := []string{"fixture-user", "fixture-password", "fixture-token", "fixture-fragment", "fixture%2Dpassword", "fixture%2Dtoken"}
  assertSafe := func(t *testing.T, message string) {
    t.Helper()
    for _, secret := range secrets {
      if strings.Contains(message, secret) { t.Errorf("diagnostic exposes %q: %s", secret, message) }
    }
  }
  for _, row := range []struct { name, source string; accepted bool }{
    {"accepted", "https://fixture-user:fixture-password@example.invalid/schema?token=fixture-token", true},
    {"uppercase", "HTTPS://fixture-user:fixture-password@example.invalid/schema?token=fixture-token", true},
    {"encoded", "https://fixture-user:fixture%2Dpassword@example.invalid/schema?token=fixture%2Dtoken", true},
    {"fragment", "https://fixture-user:fixture-password@example.invalid/schema?token=fixture-token#fixture-fragment", false},
    {"bad-host", "https://fixture-user:fixture-password@bad%zz/schema?token=fixture-token#fixture-fragment", false},
    {"missing-host", "https:?token=fixture-token#fixture-fragment", false},
    {"opaque-host", "https:fixture-user:fixture-password@example.invalid/schema?token=fixture-token", false},
    {"bad-escape", "https://fixture-user:fixture-password@example.invalid/%zz?token=fixture-token", false},
  } {
    t.Run(row.name, func(t *testing.T) {
      source, problem := normalizeSwaggerSource(row.source)
      if (problem == "") != row.accepted { t.Errorf("acceptance = %q, %q", source, problem) }
      if row.accepted && source != row.source { t.Errorf("source identity changed to %q", source) }
      assertSafe(t, problem)
      assertSafe(t, displaySwaggerSource(row.source))
      reason := "TLS rejected " + row.source + "; redirect https://fixture-user:fixture-password@redirect.invalid/next?token=fixture-token#fixture-fragment; retry " + row.source
      message := swaggerNormalizationFailure(row.source, reason)
      assertSafe(t, message)
      if !strings.Contains(message, "TLS rejected") || !strings.Contains(message, "redirect.invalid/next") { t.Errorf("useful cause lost: %s", message) }
    })
  }
  local := "missing-fixture-password?fixture-token.json"
  if displaySwaggerSource(local) != local || swaggerSafeMessage("local " + local, local) != "local " + local { t.Error("local filesystem presentation changed") }
  first := "https://host.invalid/schema?token=one"
  second := "https://host.invalid/schema?token=two"
  rememberSwaggerDocument(first, "", swaggerDocumentOutcome{Operations: []swaggerOperation{{Method:"get", Path:"/one", Digest:"one"}}})
  if _, hit := lookupSwaggerDocument(second, ""); hit { t.Error("redaction aliased different cache identities") }
  if outcome, hit := lookupSwaggerDocument(first, ""); !hit || outcome.Operations[0].Digest != "one" { t.Error("original cache identity was lost") }
}
