package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadJSONConfigFileRejectsInvalidJSON verifies JSON config parse errors are surfaced.
//
// JSON lint configs are the no-subprocess config path, so malformed files need
// to fail before rule parsing starts. The returned error should keep the file
// path context that helps callers identify the broken config.
//
// This scenario targets the loadJSONConfigFile branch that wraps
// json.Unmarshal failures separately from read errors and container validation.
//
// 1. Write a malformed lint config JSON file.
// 2. Load it through the JSON config loader directly.
// 3. Assert the diagnostic reports a config-file parse failure.
//
// @evidence contracts/testing.md#behavioral-verification loadJSONConfigFile rejects the truncated JSON fixture and reports parse-config context instead of accepting an incomplete severity map.
// @evidence contracts/testing.md#independent-expectations JSON object syntax requires the missing value closure; the independently authored malformed input and literal parse-context error do not derive from the loader.
// @evidence contracts/testing.md#distinguishing-cases Owns malformed JSON that can be read successfully; valid JSON configs and rules-container validation execute separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit writes one malformed temporary JSON config and directly invokes loadJSONConfigFile in the shared lint process; file-scoped parse failure is observed without a script evaluator or child compiler.
func TestLoadJSONConfigFileRejectsInvalidJSON(t *testing.T) {
  dir := t.TempDir()
  location := filepath.Join(dir, "lint.config.json")
  writeFile(t, location, `{"no-var": "error",`)

  _, err := loadJSONConfigFile(location)
  if err == nil {
    t.Fatal("expected invalid JSON to fail")
  }
  if !strings.Contains(err.Error(), "parse config file") || !strings.Contains(err.Error(), location) {
    t.Fatalf("error should mention JSON parse context, got %v", err)
  }
}
