package banner_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestConfigValueBranches verifies banner config value coercion, key validation, and JSDoc escaping.
//
// Banner text arrives from a config file (string export, object export, or
// invalid). This pins the exact acceptance contract for loaded config values
// and the JSDoc rendering before path discovery and loader tests exercise the
// same helper through file-backed inputs.
//
//  1. Coerce nil, string, object, and invalid values through the shared helper.
//  2. Validate tsconfig plugin entry keys: framework keys pass, unknown keys fail.
//  3. Render a banner with Windows newlines and a closing-comment token via an
//     explicit configFile path, asserting JSDoc escaping and trailing-blank-line
//     stripping.
func TestConfigValueBranches(t *testing.T) {
  // bannerTextFromConfigValue: nil, string, object, invalid.
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

  // validateBannerConfig: framework keys pass, known banner key passes, unknown keys fail.
  if err := bannerValidateBannerConfig(map[string]any{}); err != nil {
    t.Fatalf("empty config should be valid: %v", err)
  }
  for _, key := range []string{"transform", "name", "stage", "enabled"} {
    if err := bannerValidateBannerConfig(map[string]any{key: "x"}); err != nil {
      t.Fatalf("framework key %q should be valid: %v", key, err)
    }
  }
  if err := bannerValidateBannerConfig(map[string]any{"configFile": "banner.config.json"}); err != nil {
    t.Fatalf("configFile key should be valid: %v", err)
  }
  for _, badKey := range []string{"text", "config", "banner", "options"} {
    if err := bannerValidateBannerConfig(map[string]any{badKey: "x"}); err == nil || !strings.Contains(err.Error(), "unsupported key") {
      t.Fatalf("expected unsupported key error for %q, got %v", badKey, err)
    }
  }

  // parseBanner via explicit configFile: Windows newlines, JSDoc escaping, trailing blank.
  root := t.TempDir()
  tsconfig := filepath.Join(root, "tsconfig.json")
  writeFile(t, tsconfig, "{}")
  configFile := filepath.Join(root, "banner.config.cjs")
  writeFile(t, configFile, `module.exports = "one\r\ntwo */\n\n";`)

  rendered, err := bannerParseBanner(map[string]any{"configFile": configFile}, root, tsconfig)
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(rendered, " * one\n * two * /\n") || strings.Contains(rendered, "*/\n\n") {
    t.Fatalf("rendered banner mismatch:\n%s", rendered)
  }
  if got := bannerSanitizeJSDocLine("a */ b"); got != "a * / b" {
    t.Fatalf("sanitize mismatch: %q", got)
  }

  // parseBanner: empty text from config file produces an error.
  emptyConfigFile := filepath.Join(root, "empty", "banner.config.cjs")
  writeFile(t, emptyConfigFile, `module.exports = "";`)
  if _, err := bannerParseBanner(map[string]any{"configFile": emptyConfigFile}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must be a non-empty string") {
    t.Fatalf("expected parse error, got %v", err)
  }
}
