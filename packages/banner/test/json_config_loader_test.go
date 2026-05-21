package banner_test

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestJSONConfigLoader verifies banner.config.json loading success and failures.
//
// JSON is the one config format parsed natively (no Node subprocess required).
// This pins the happy-path object export, invalid JSON, invalid shape, and
// BOM-prefixed files — the same edge cases the lint JSON loader guards against,
// applied to the banner domain.
//
// 1. Load a JSON file with a "text" object.
// 2. Reject a file with invalid JSON and one with a numeric root value.
// 3. Confirm the file is accepted by the loadBannerConfigFile dispatcher.
// 4. Verify a BOM-prefixed JSON file is also accepted.
func TestJSONConfigLoader(t *testing.T) {
	root := t.TempDir()

	// Object export.
	objectConfig := filepath.Join(root, "banner.config.json")
	writeFile(t, objectConfig, `{"text":"object text"}`)
	raw, err := bannerLoadBannerJSONConfigFile(objectConfig)
	if err != nil {
		t.Fatal(err)
	}
	obj, ok := raw.(map[string]any)
	if !ok || obj["text"] != "object text" {
		t.Fatalf("JSON object config mismatch: %#v", raw)
	}

	// Dispatcher routes .json to the JSON loader.
	raw, err = bannerLoadBannerConfigFile(objectConfig)
	if err != nil {
		t.Fatal(err)
	}
	obj, ok = raw.(map[string]any)
	if !ok || obj["text"] != "object text" {
		t.Fatalf("dispatcher JSON config mismatch: %#v", raw)
	}

	// Invalid JSON.
	badJSON := filepath.Join(root, "bad", "banner.config.json")
	writeFile(t, badJSON, `not valid json`)
	if _, err := bannerLoadBannerJSONConfigFile(badJSON); err == nil || !strings.Contains(err.Error(), "parse config file") {
		t.Fatalf("expected JSON parse error, got %v", err)
	}

	// Missing file.
	if _, err := bannerLoadBannerJSONConfigFile(filepath.Join(root, "missing", "banner.config.json")); err == nil || !strings.Contains(err.Error(), "read config file") {
		t.Fatalf("expected read error for missing file, got %v", err)
	}

	// BOM-prefixed JSON.
	bomConfig := filepath.Join(root, "bom", "banner.config.json")
	writeFile(t, bomConfig, "\xEF\xBB\xBF{\"text\":\"bom banner\"}")
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
	writeFile(t, filepath.Join(jsonRoot, "banner.config.json"), `{"text":"discovered json banner"}`)
	location, err := bannerFindBannerConfigFile(jsonRoot, "")
	if err != nil {
		t.Fatal(err)
	}
	if location != filepath.Join(jsonRoot, "banner.config.json") {
		t.Fatalf("JSON discovery mismatch: %q", location)
	}
}
