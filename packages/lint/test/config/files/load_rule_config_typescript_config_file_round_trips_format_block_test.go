package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigTypeScriptConfigFileRoundTripsFormatBlock pins the
// dropped-`format` regression for the .ts/.cts/.mts ttsx loader.
//
// The embedded ttsx loader's `toSerializableConfig` used to omit `format` from
// its copy list, so a `lint.config.ts` whose only key was `format` round-tripped
// to an empty object and the formatter silently used defaults. The rewritten
// serializer copies `format` verbatim; this test loads a .ts config carrying
// only a `format` block and asserts the prettier option survives evaluation.
//
// 1. Write a ttsc-lint.config.ts default-exporting `{ format: { semi: false } }`.
// 2. Load it through LoadConfigResolver and read the formatSemi options.
// 3. Assert `prefer` decodes to "never" — proof `format` was not dropped.
func TestLoadRuleConfigTypeScriptConfigFileRoundTripsFormatBlock(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.ts"), `const config = {
    format: { semi: false },
  };
  export default config;`)

  resolver, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.ts",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  raw := resolver.RuleOptions("formatSemi")
  if len(raw) == 0 {
    t.Fatal("format block was dropped: formatSemi has no options")
  }
  var opts struct {
    Prefer string `json:"prefer"`
  }
  if err := json.Unmarshal(raw, &opts); err != nil {
    t.Fatalf("decode formatSemi options: %v", err)
  }
  if opts.Prefer != "never" {
    t.Fatalf("prefer want \"never\" (format block round-tripped), got %q", opts.Prefer)
  }
}
