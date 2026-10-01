package banner_test

import (
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestJSONConfigLoader verifies banner.config.json loading success and failures.
//
// JSON is the one config format parsed natively (no Node subprocess required).
// This pins the object value, malformed JSON, missing-file errors, and
// BOM-prefixed files — the same edge cases the lint JSON loader guards against,
// applied to the banner domain.
//
// 1. Load a JSON file with a "text" object.
// 2. Reject malformed JSON and a missing config file.
// 3. Confirm the file is accepted by the loadBannerConfigFile dispatcher.
// 4. Verify a BOM-prefixed JSON file is also accepted.
//
// @evidence contracts/testing.md#behavioral-verification Calls bannerLoadBannerJSONConfigFile and its dispatcher to assert object text, BOM acceptance, malformed JSON/read errors and JSON filename discovery.
// @evidence contracts/testing.md#independent-expectations Literal JSON and BOM bytes supply independent value expectations; malformed syntax cannot parse and the missing fixture cannot be read. JSON discovery follows the supported config filename.
// @evidence contracts/testing.md#distinguishing-cases Owns native object/dispatcher success, BOM, syntax error, missing file and discovery. There is no numeric-root rejection assertion or executable-config coverage in this case.
// @evidence contracts/testing.md#execution-ownership Unit entry TestJSONConfigLoader is selected from test/unit by the utility runner unit overlay. Runs banner JSON read/parse/dispatcher and discovery in the Go process over ordinary files; the selected JSON branch starts no Node or ttsx child.
func TestJSONConfigLoader(t *testing.T) {
  root := t.TempDir()

  // Object export.
  objectConfig := filepath.Join(root, "banner.config.json")
  shared.WriteFile(t, objectConfig, `{"text":"object text"}`)
  raw, err := bannerLoadBannerJSONConfigFile(objectConfig)
  if err != nil {
    t.Fatal(err)
  }
  obj, ok := raw.(map[string]any)
  if !ok || obj["text"] != "object text" {
    t.Fatalf("JSON object config mismatch: %#v", raw)
  }

  // Dispatcher routes .json to the JSON loader.
  raw, err = shared.BannerLoadBannerConfigFile(objectConfig, root)
  if err != nil {
    t.Fatal(err)
  }
  obj, ok = raw.(map[string]any)
  if !ok || obj["text"] != "object text" {
    t.Fatalf("dispatcher JSON config mismatch: %#v", raw)
  }

  // Invalid JSON.
  badJSON := filepath.Join(root, "bad", "banner.config.json")
  shared.WriteFile(t, badJSON, `not valid json`)
  if _, err := bannerLoadBannerJSONConfigFile(badJSON); err == nil || !strings.Contains(err.Error(), "parse config file") {
    t.Fatalf("expected JSON parse error, got %v", err)
  }

  // Missing file.
  if _, err := bannerLoadBannerJSONConfigFile(filepath.Join(root, "missing", "banner.config.json")); err == nil || !strings.Contains(err.Error(), "read config file") {
    t.Fatalf("expected read error for missing file, got %v", err)
  }

  // BOM-prefixed JSON.
  bomConfig := filepath.Join(root, "bom", "banner.config.json")
  shared.WriteFile(t, bomConfig, "\xEF\xBB\xBF{\"text\":\"bom banner\"}")
  raw, err = bannerLoadBannerJSONConfigFile(bomConfig)
  if err != nil {
    t.Fatalf("BOM-prefixed JSON should be accepted: %v", err)
  }
  obj, ok = raw.(map[string]any)
  if !ok || obj["text"] != "bom banner" {
    t.Fatalf("BOM JSON config mismatch: %#v", raw)
  }

  // Auto-discovery picks up banner.config.json.
  jsonRoot := filepath.Join(root, "json-discovery")
  shared.WriteFile(t, filepath.Join(jsonRoot, "banner.config.json"), `{"text":"discovered json banner"}`)
  location, _, err := bannerFindBannerConfigFile(jsonRoot, "")
  if err != nil {
    t.Fatal(err)
  }
  if location != filepath.Join(jsonRoot, "banner.config.json") {
    t.Fatalf("JSON discovery mismatch: %q", location)
  }
}
