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
// rather than silently falling back to defaults. "configFile", "name", and
// "transform" are among the permitted host keys on the plugin entry.
//
//  1. Call loadStripConfigMap with various disallowed keys (calls, statements,
//     and an arbitrary unknown key).
//  2. Assert each call returns a non-nil unsupported-key error.
//  3. Assert that a clean transform-only entry succeeds.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripLoadStripConfigMap with calls, statements and foo keys and asserts unsupported-key errors; a clean transform-only entry succeeds.
// @evidence contracts/testing.md#independent-expectations Strip options belong in strip.config.* rather than the plugin entry. The literal stale keys violate that contract, while transform is a supported host key.
// @evidence contracts/testing.md#distinguishing-cases Owns three disallowed keys and a clean entry with no config. Assertions check unsupported-key wording, not key-name/remedy details or every permitted key.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigRejectsUnsupportedTsconfigKeys is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripLoadStripConfigMap validation and empty-config discovery in the Go process; no executable config or compiler project is loaded.
func TestConfigRejectsUnsupportedTsconfigKeys(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
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
