package banner_test

import (
  "strings"
  "testing"
)

// TestConfigValueBranches verifies banner text config coercion and JSDoc escaping.
//
// Banner text can arrive inline, from a config-file default export, or from an
// object export. This pins the exact acceptance contract before path discovery
// and loader tests start exercising the same helper through file-backed inputs.
//
// 1. Coerce nil, string, object, and invalid values through the shared helper.
// 2. Render an inline banner with Windows newlines and a closing-comment token.
// 3. Assert empty values fail and emitted JSDoc cannot terminate early.
func TestConfigValueBranches(t *testing.T) {
  text, ok, err := bannerTextFromConfigValue(nil, "nil")
  if text != "" || ok || err != nil {
    t.Fatalf("nil value mismatch: text=%q ok=%v err=%v", text, ok, err)
  }
  text, ok, err = bannerTextFromConfigValue("inline", "string")
  if text != "inline" || !ok || err != nil {
    t.Fatalf("string value mismatch: text=%q ok=%v err=%v", text, ok, err)
  }
  text, ok, err = bannerTextFromConfigValue(map[string]any{"text": "object"}, "object")
  if text != "object" || !ok || err != nil {
    t.Fatalf("object value mismatch: text=%q ok=%v err=%v", text, ok, err)
  }
  text, ok, err = bannerTextFromConfigValue(map[string]any{"other": true}, "object")
  if text != "" || ok || err != nil {
    t.Fatalf("object without text mismatch: text=%q ok=%v err=%v", text, ok, err)
  }
  for label, raw := range map[string]any{
    "empty string": " \n\t",
    "bad raw":      123,
    "bad text":     map[string]any{"text": 123},
  } {
    if _, _, err := bannerTextFromConfigValue(raw, label); err == nil {
      t.Fatalf("expected %s to fail", label)
    }
  }
  rendered, err := bannerParseBanner(map[string]any{"text": "one\r\ntwo */\n\n"}, "", "")
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(rendered, " * one\n * two * /\n") || strings.Contains(rendered, "*/\n\n") {
    t.Fatalf("rendered banner mismatch:\n%s", rendered)
  }
  if got := bannerSanitizeJSDocLine("a */ b"); got != "a * / b" {
    t.Fatalf("sanitize mismatch: %q", got)
  }
  if _, err := bannerParseBanner(map[string]any{"text": ""}, "", ""); err == nil || !strings.Contains(err.Error(), `"text" must be a non-empty string`) {
    t.Fatalf("expected parse error, got %v", err)
  }
}
