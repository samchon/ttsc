package evidence

import (
  "strings"
  "testing"
)

// TestSwaggerURLPresentation verifies lexical redaction before URL parsing.
//
// Presentation must work for malformed addresses too, because parse errors may
// quote the rejected input. Ordinary local filesystem text is outside this rule.
//
// 1. Compare valid, malformed, uppercase and missing-host addresses with literal
//    expected display strings.
// 2. Sanitize a repeated source and an independently supplied redirect URL.
// 3. Retain a local filename and meaningful external failure text.
//
// @evidence contracts/testing.md#behavioral-verification displaySwaggerSource and swaggerSafeMessage remove URL user information, query values and fragments with exact expected output for every row, retain host/path/cause and leave local filesystem errors unchanged.
// @evidence contracts/testing.md#independent-expectations Hand-written safe strings specify the diagnostic contract independently of the lexical algorithm, including malformed input whose semantics a URL parser cannot supply.
// @evidence contracts/testing.md#distinguishing-cases User information, absent/empty query and fragment, encoded credentials, malformed host, uppercase scheme, missing host, repeated source and foreign redirect contrast with a local filename containing query-like characters.
// @evidence contracts/testing.md#execution-ownership This selectable Go unit runs only presentation operations with standard library imports in-process. Table rows use t.Run to collect failures; no filesystem, child, native artifact, compiler host or installed consumer is started.
func TestSwaggerURLPresentation(t *testing.T) {
  for _, row := range []struct{ source, want string }{
    {"https://user:password@host.invalid/api?token=value#secret", "https://<redacted>@host.invalid/api?<redacted>#<redacted>"},
    {"HTTPS://user:password@host.invalid/api?token=value", "HTTPS://<redacted>@host.invalid/api?<redacted>"},
    {"https://user:p%40ssword@bad%zz/api?token=value#secret", "https://<redacted>@bad%zz/api?<redacted>#<redacted>"},
    {"https:?token=value#secret", "https:?<redacted>#<redacted>"},
    {"https:user:password@host.invalid/api?token=value", "https:<redacted>@host.invalid/api?<redacted>"},
    {"https:/user:password@host.invalid/api?token=value", "https:/<redacted>@host.invalid/api?<redacted>"},
    {"https://host.invalid/api?#", "https://host.invalid/api?<redacted>#<redacted>"},
    {"https://host.invalid/api", "https://host.invalid/api"},
    {"local/password?token#secret.json", "local/password?token#secret.json"},
    {"C:/local/password?token#secret.json", "C:/local/password?token#secret.json"},
  } {
    t.Run(row.source, func(t *testing.T) {
      if got := displaySwaggerSource(row.source); got != row.want { t.Errorf("display = %q, want %q", got, row.want) }
    })
  }
  source := "https://user:password@host.invalid/api?token=value#secret"
  want := "fetch https://<redacted>@host.invalid/api?<redacted>#<redacted>"
  if got := swaggerSafeMessage("fetch " + source,source); got != want { t.Errorf("message = %q, want %q",got,want) }
  if got := swaggerSafeMessage(want,source); got != want { t.Errorf("safe message changed: %q",got) }
  reason := "TLS refused " + source + "; redirect https://other:redirect-password@redirect.invalid/next?token=redirect-token#redirect-fragment; retry " + source
  message := swaggerSafeMessage(reason,source)
  for _, secret := range []string{"user:","password","token=value","#secret","other:","redirect-token","redirect-fragment"} {
    if strings.Contains(message,secret) { t.Errorf("message exposes %q: %s",secret,message) }
  }
  if !strings.Contains(message,"TLS refused") || !strings.Contains(message,"host.invalid/api") || !strings.Contains(message,"redirect.invalid/next") { t.Errorf("cause/location lost: %s",message) }
  local := "local/password?token#secret.json"
  if swaggerSafeMessage("missing " + local,local) != "missing " + local { t.Error("local error changed") }
}
