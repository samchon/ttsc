package evidence

import (
  "strings"
  "testing"
)

// TestSwaggerURLErrorsRedactSecretPresentation verifies native URL diagnostics
// protect secret parts without changing transport or cache identity.
//
// 1. Format reflected URLs, malformed configuration and a local file failure.
// 2. Require useful host/path and failure categories while refusing all secrets.
// 3. Decode an accepted secret-bearing URL and keep its exact source identity.
//
// @evidence contracts/testing.md#behavioral-verification Calls normalizeSwaggerSource, displaySwaggerSource and swaggerNormalizationFailure, including remembered failure formatting through swaggerUnitsFromOutcome. Diagnostics must remove fake secrets, retain source/cause and leave local filesystem text intact; accepted URL keys are compared byte-for-byte.
// @evidence contracts/testing.md#independent-expectations Fake literal user/password/token/fragment values define forbidden text independently of the formatter. Host/path, HTTP/TLS/timeout/JSON causes and unchanged local error text are literal expectations; URL configuration rejection remains mandatory. Quoted URL boundaries place the trailing cause outside the URL; comparing once-displayed and reflected presentation detects marker rescanning alongside independent secret and cause assertions.
// @evidence contracts/testing.md#distinguishing-cases Covers repeated and foreign URLs, credential/query/fragment combinations, mixed scheme case, malformed host/escape/port, missing host, credential-only and query-only sources, empty reasons, local files and accepted remote source identity. Cached and direct failure formatting must agree.
// @evidence contracts/testing.md#execution-ownership This selectable Go unit calls native configuration and presentation owners in-process. It starts no Node child or product host, requires no build or installation and independently runs every named subtest.
func TestSwaggerURLErrorsRedactSecretPresentation(t *testing.T) {
  source := "https://fixture-user:fixture-password@example.invalid/schema?token=fixture-token#fixture-fragment"
  foreign := "https://other-user:other-password@other.invalid/api?key=other-token#other-fragment"
  secrets := []string{"fixture-user", "fixture-password", "fixture-token", "fixture-fragment", "other-user", "other-password", "other-token", "other-fragment"}
  safe := func(t *testing.T, text string) {
    t.Helper()
    for _, secret := range secrets {
      if strings.Contains(text, secret) {
        t.Errorf("diagnostic contains secret %q: %s", secret, text)
      }
    }
  }
  for _, reason := range []string{"HTTP 503", "TLS certificate verification failed", "timeout", "JSON parse failure"} {
    t.Run(reason, func(t *testing.T) {
      message := reason + " " + source + " again " + source + " foreign " + foreign
      got := swaggerNormalizationFailure(source, message)
      safe(t, got)
      for _, required := range []string{"example.invalid/schema", "other.invalid/api", reason} {
        if !strings.Contains(got, required) {
          t.Errorf("missing useful cause/source %q: %s", required, got)
        }
      }
      inventory := &artifactInventory{}
      problems := swaggerUnitsFromOutcome(source, inventory, swaggerDocumentOutcome{Rejected: true, Problem: message})
      if len(problems) != 1 || problems[0] != got || !inventory.LoadFailed {
        t.Errorf("cached failure must match direct presentation: %+v / %+v", problems, inventory)
      }
    })
  }
  invalid := []string{
    source,
    "HTTPS://fixture-user:fixture-password@bad%host/schema?token=fixture-token#fixture-fragment",
    "https://fixture-user:fixture-password@example.invalid:bad/schema?token=fixture-token",
    "https://fixture-user:fixture-password?oops@bad%host/schema?token=fixture-token#fixture-fragment",
    "https://fixture-user:fixture-password#oops@bad%host/schema?token=fixture-token",
    "https://example.invalid/%ZZ?token=fixture-token#fixture-fragment",
    "https:/schema?token=fixture-token#fixture-fragment",
  }
  for _, value := range invalid {
    t.Run("invalid_"+displaySwaggerSource(value), func(t *testing.T) {
      normalized, problem := normalizeSwaggerSource(value)
      if normalized != "" || problem == "" {
        t.Errorf("invalid source was accepted: %q / %q", normalized, problem)
      }
      safe(t, problem)
      display := displaySwaggerSource(value)
      safe(t, display)
      reflected := swaggerNormalizationFailure(value, "transport failure '"+value+"' trailing cause")
      safe(t, reflected)
      if !strings.Contains(reflected, "transport failure '"+display+"' trailing cause") {
        t.Errorf("repeated presentation corrupted the source or trailing cause: %s", reflected)
      }
    })
  }
  t.Run("raw_identity", func(t *testing.T) {
    value := "HTTPS://fixture-user:fixture-password@example.invalid/schema?token=fixture-token"
    normalized, problem := normalizeSwaggerSource(value)
    if problem != "" || normalized != value {
      t.Errorf("accepted URL must keep its exact key: %q / %q", normalized, problem)
    }
    for _, value := range []string{value, "https://fixture-user:fixture-password@example.invalid/schema", "https://example.invalid/schema?token=fixture-token"} {
      safe(t, swaggerNormalizationFailure(value, "failure "+value))
    }
  })
  t.Run("local_and_empty_causes", func(t *testing.T) {
    local := "docs/fixture-token.json"
    reason := "open docs/fixture-token.json: permission denied"
    if got := swaggerNormalizationFailure(local, reason); !strings.Contains(got, reason) {
      t.Errorf("local cause changed: %q", got)
    }
    if got := displaySwaggerSource(local); got != local {
      t.Errorf("local spelling changed: %q", got)
    }
    if got := swaggerNormalizationFailure(source, ""); !strings.Contains(got, "normalizer reported no reason") {
      t.Errorf("empty cause lost its explanation: %q", got)
    }
  })
}
