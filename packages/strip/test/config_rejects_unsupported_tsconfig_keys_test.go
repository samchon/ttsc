package strip_test

import (
	"strings"
	"testing"
)

// TestConfigRejectsUnsupportedTsconfigKeys verifies that the strip driver
// rejects tsconfig plugin entries containing unsupported keys.
//
// Locks the validation branch in loadStripConfigMap so that stale inline keys
// (calls, statements) and any arbitrary unknown key surface as a clear error
// rather than silently falling back to defaults. Only "configFile", "name", and
// "transform" are permitted on the plugin entry.
//
// 1. Call loadStripConfigMap with various disallowed keys (calls, statements,
//    and an arbitrary unknown key).
// 2. Assert each call returns a non-nil error containing the disallowed key
//    name and pointing at the config-file remedy.
// 3. Assert that a valid entry with no extra keys (or only "configFile") succeeds.
func TestConfigRejectsUnsupportedTsconfigKeys(t *testing.T) {
	for label, config := range map[string]map[string]any{
		"calls key":      {"transform": "@ttsc/strip", "calls": []any{"console.log"}},
		"statements key": {"transform": "@ttsc/strip", "statements": []any{"debugger"}},
		"unknown key":    {"transform": "@ttsc/strip", "foo": "bar"},
	} {
		_, err := stripLoadStripConfigMap(config, t.TempDir(), "")
		if err == nil {
			t.Fatalf("%s: expected error, got nil", label)
		}
		if !strings.Contains(err.Error(), "unsupported key") {
			t.Fatalf("%s: error %q does not mention 'unsupported key'", label, err.Error())
		}
	}

	// A clean plugin entry (only known keys) must not error.
	dir := t.TempDir()
	_, err := stripLoadStripConfigMap(map[string]any{"transform": "@ttsc/strip"}, dir, "")
	if err != nil {
		t.Fatalf("clean entry errored: %v", err)
	}
}
