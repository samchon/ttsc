package banner_test

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestConfigRejectsUnknownTsconfigKeys verifies that unknown tsconfig plugin entry keys are rejected.
//
// Banner configuration must live exclusively in a banner.config.* file. Any key
// in the tsconfig plugin entry that is not the single accepted "configFile" key
// (or a framework-owned key like "transform"/"enabled") must produce a specific
// error that names the offending key and points users at the config file. This
// prevents silent no-ops when a user adds "text" inline expecting a banner.
//
// 1. Pass each formerly-accepted inline key ("text", "config") in the config map.
// 2. Assert a non-nil error whose message names the key and mentions "configFile".
// 3. Confirm that "configFile" itself and framework keys ("transform", "enabled",
//    "name", "stage") are accepted without error even when no config file exists.
func TestConfigRejectsUnknownTsconfigKeys(t *testing.T) {
	root := t.TempDir()
	tsconfig := filepath.Join(root, "tsconfig.json")
	writeFile(t, tsconfig, "{}")

	// Formerly-accepted keys that are now banned.
	for _, key := range []string{"text", "config", "banner", "after", "before", "phase"} {
		config := map[string]any{key: "some value"}
		err := bannerValidateBannerConfig(config)
		if err == nil {
			t.Fatalf("expected error for key %q, got nil", key)
		}
		if !strings.Contains(err.Error(), key) {
			t.Fatalf("error for key %q should name the key: %v", key, err)
		}
		if !strings.Contains(err.Error(), "unsupported key") {
			t.Fatalf("error for key %q should say 'unsupported key': %v", key, err)
		}
		if !strings.Contains(err.Error(), "configFile") {
			t.Fatalf("error for key %q should mention 'configFile': %v", key, err)
		}
	}

	// "configFile" is the one accepted banner-specific key.
	if err := bannerValidateBannerConfig(map[string]any{"configFile": "banner.config.json"}); err != nil {
		t.Fatalf("configFile should be accepted: %v", err)
	}

	// Framework keys pass through without error.
	frameworkCases := map[string]any{
		"transform": "@ttsc/banner",
		"enabled":   true,
		"name":      "@ttsc/banner",
		"stage":     "transform",
	}
	for key, val := range frameworkCases {
		if err := bannerValidateBannerConfig(map[string]any{key: val}); err != nil {
			t.Fatalf("framework key %q should be accepted: %v", key, err)
		}
	}

	// resolveBannerText surfaces the same error when called with a banned key.
	if _, err := bannerResolveBannerText(map[string]any{"text": "hello"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `unsupported key "text"`) {
		t.Fatalf("resolveBannerText should reject 'text' key, got %v", err)
	}
	if _, err := bannerResolveBannerText(map[string]any{"config": "banner.config.cjs"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `unsupported key "config"`) {
		t.Fatalf("resolveBannerText should reject 'config' key, got %v", err)
	}
}
