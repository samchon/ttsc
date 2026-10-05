package strip_test

import (
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestConfigRejectsUnusableConfigFiles verifies that the strip driver names the
// problem when an explicit config file cannot supply a strip configuration.
//
// Falling back to the built-in defaults on any of these would strip calls the
// author never listed, so each shape must fail loudly, and a JSON file saved
// with a UTF-8 byte order mark by a Windows editor must still load.
//
//  1. Pass a blank and a non-string configFile.
//  2. Point configFile at an unsupported extension, a missing file, malformed
//     JSON and JSON values that are not objects.
//  3. Load a JSON config that begins with a byte order mark.
//
// @evidence contracts/testing.md#behavioral-verification Calls the real loader with blank and non-string configFile, an unsupported extension, a missing file, malformed JSON and array and string JSON, asserting each error text; a BOM-prefixed JSON object loads with its literal calls.
// @evidence contracts/testing.md#independent-expectations The expectations are the documented failure phrases of the config contract and the literal calls list of the authored BOM fixture; nothing is derived from the loader's own output.
// @evidence contracts/testing.md#distinguishing-cases Owns the configFile validation, extension, read, parse and object-shape failures and the BOM boundary; discovery, ambiguity and unsupported plugin keys have their own cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigRejectsUnusableConfigFiles is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. It runs the loader and native JSON parsing in the Go process; JavaScript and TypeScript configs are never evaluated.
func TestConfigRejectsUnusableConfigFiles(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  root := shared.StripRealpathIfPossible(t.TempDir())
  shared.WriteFile(t, filepath.Join(root, "strip.config.yaml"), "calls: []\n")
  shared.WriteFile(t, filepath.Join(root, "broken.json"), `{"calls":`)
  shared.WriteFile(t, filepath.Join(root, "array.json"), `[]`)
  shared.WriteFile(t, filepath.Join(root, "string.json"), `"calls"`)
  shared.WriteFile(t, filepath.Join(root, "bom.json"), "\xef\xbb\xbf"+`{"calls":["bom.trace"]}`)
  tsconfig := filepath.Join(root, "tsconfig.json")

  for label, testCase := range map[string]struct {
    entry map[string]any
    want  string
  }{
    "blank configFile":      {map[string]any{"configFile": "  "}, "must be a non-empty string path"},
    "non-string configFile": {map[string]any{"configFile": 1}, "must be a non-empty string path"},
    "unsupported extension": {map[string]any{"configFile": "strip.config.yaml"}, "unsupported config file extension"},
    "missing file":          {map[string]any{"configFile": "absent.json"}, "read config file"},
    "malformed json":        {map[string]any{"configFile": "broken.json"}, "parse config file"},
    "array json":            {map[string]any{"configFile": "array.json"}, "must export an object"},
    "string json":           {map[string]any{"configFile": "string.json"}, "must export an object"},
  } {
    _, err := stripLoadStripConfigMap(testCase.entry, root, tsconfig)
    if err == nil || !strings.Contains(err.Error(), testCase.want) {
      t.Fatalf("%s: error = %v, want it to contain %q", label, err, testCase.want)
    }
  }

  config, err := stripLoadStripConfigMap(map[string]any{"configFile": "bom.json"}, root, tsconfig)
  if err != nil {
    t.Fatalf("BOM-prefixed JSON failed to load: %v", err)
  }
  if calls, ok := config["calls"].([]any); !ok || len(calls) != 1 || calls[0] != "bom.trace" {
    t.Fatalf("unexpected BOM config calls: %#v", config["calls"])
  }
}
