package banner_test

import (
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestConfigValueBranches verifies banner config value coercion, key validation, and JSDoc escaping.
//
// Banner text arrives from a config file that must export an object with a
// non-empty "text" string. This pins the exact acceptance contract for loaded
// config values — bare strings are rejected — and the JSDoc rendering before
// path discovery and loader tests exercise the same helper through file-backed
// inputs.
//
//  1. Coerce nil, object, and invalid (including bare-string) values through the
//     shared helper.
//  2. Validate tsconfig plugin entry keys: framework keys pass, unknown keys fail.
//  3. Render a banner with Windows newlines and a closing-comment token via an
//     explicit configFile path, asserting JSDoc escaping and trailing-blank-line
//     stripping.
//  4. Render whitespace-only trailing lines, an interior blank line and
//     overlapping closing tokens, and reject whitespace-only text.
//
// @evidence contracts/testing.md#behavioral-verification Banner coercion accepts nil/object text and rejects invalid values; framework/configFile keys pass and former inline keys fail. parseBanner over a JSON config file normalizes CRLF, strips trailing blank and whitespace-only lines, keeps an interior blank line, escapes */ and rejects empty or whitespace-only text.
// @evidence contracts/testing.md#independent-expectations Authored scalar/object inputs and literal expected comments (a * / b, * /* /, the 64-dash separator and the packageDocumentation footer) define independent coercion/escaping/rendering expectations; the loaded text comes from authored JSON bytes.
// @evidence contracts/testing.md#distinguishing-cases Object text contrasts with missing/bare/numeric values; allowed keys contrast with text/config/banner/options. Nonempty CRLF text, an interior blank line and a whitespace-only trailing line contrast with a JSON config whose text is the empty string or only whitespace, which parseBanner rejects as must be a non-empty string. Two adjacent closing tokens contrast with a single one.
// @evidence contracts/testing.md#execution-ownership TestConfigValueBranches executes coercion, validation, sanitization and JSON-backed parseBanner through test bridges in one Go process. No Node, compiler or native producer is launched.
func TestConfigValueBranches(t *testing.T) {
  // bannerTextFromConfigValue: nil, object, invalid.
  text, ok, err := bannerTextFromConfigValue(nil, "nil")
  if text != "" || ok || err != nil {
    t.Fatalf("nil value mismatch: text=%q ok=%v err=%v", text, ok, err)
  }
  text, ok, err = bannerTextFromConfigValue(map[string]any{"text": "object"}, "object")
  if text != "object" || !ok || err != nil {
    t.Fatalf("object value mismatch: text=%q ok=%v err=%v", text, ok, err)
  }
  text, ok, err = bannerTextFromConfigValue(map[string]any{"other": true}, "object")
  if text != "" || ok || err != nil {
    t.Fatalf("object without text mismatch: text=%q ok=%v err=%v", text, ok, err)
  }
  // A bare string is no longer a valid banner config value.
  if _, _, err := bannerTextFromConfigValue("inline", "string"); err == nil || !strings.Contains(err.Error(), "must be an object") {
    t.Fatalf("expected bare-string rejection, got %v", err)
  }
  for label, raw := range map[string]any{
    "bad raw":  123,
    "bad text": map[string]any{"text": 123},
    "blank text": map[string]any{"text": " \t\n"},
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
  shared.WriteFile(t, tsconfig, "{}")
  configFile := filepath.Join(root, "banner.config.json")
  shared.WriteFile(t, configFile, `{"text":"one\r\ntwo */\n\n"}`)

  rendered, err := bannerParseBanner(map[string]any{"configFile": configFile}, root, tsconfig)
  if err != nil {
    t.Fatal(err)
  }
  expected := "/**\n * " + strings.Repeat("-", 64) + "\n * one\n * two * /\n *\n * @packageDocumentation\n */\n"
  if rendered != expected {
    t.Fatalf("rendered banner mismatch:\n%s", rendered)
  }
  if got := bannerSanitizeJSDocLine("a */ b"); got != "a * / b" {
    t.Fatalf("sanitize mismatch: %q", got)
  }
  if got := bannerSanitizeJSDocLine("*/*/"); got != "* /* /" {
    t.Fatalf("adjacent closing tokens sanitize mismatch: %q", got)
  }

  // Whitespace-only trailing lines are dropped, an interior blank line is kept.
  spacedConfigFile := filepath.Join(root, "spaced", "banner.config.json")
  shared.WriteFile(t, spacedConfigFile, `{"text":"a\n\nb\n \t\n"}`)
  spaced, err := bannerParseBanner(map[string]any{"configFile": spacedConfigFile}, root, tsconfig)
  if err != nil {
    t.Fatal(err)
  }
  spacedExpected := "/**\n * " + strings.Repeat("-", 64) + "\n * a\n * \n * b\n *\n * @packageDocumentation\n */\n"
  if spaced != spacedExpected {
    t.Fatalf("spaced banner mismatch:\n%q\nwant\n%q", spaced, spacedExpected)
  }

  // parseBanner: empty "text" from config file produces an error.
  emptyConfigFile := filepath.Join(root, "empty", "banner.config.json")
  shared.WriteFile(t, emptyConfigFile, `{"text":""}`)
  if _, err := bannerParseBanner(map[string]any{"configFile": emptyConfigFile}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must be a non-empty string") {
    t.Fatalf("expected parse error, got %v", err)
  }
}
