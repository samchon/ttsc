package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigJavaScriptConfigFileRoundTripsFormatBlock pins the
// dropped-`format` regression for the .js/.cjs/.mjs loader.
//
// The embedded Node loader's `toSerializableConfig` used to omit `format` from
// its copy list (it only copied basePath/extends/files/ignores/rules), so a
// `lint.config.cjs` whose only key was `format` round-tripped to an empty
// object and every formatter option silently fell back to defaults. The
// rewritten serializer copies `format` verbatim; this test loads a .cjs config
// carrying only a `format` block and asserts the prettier option survives the
// JSON round trip into the engine's option blob.
//
// 1. Write a ttsc-lint.config.cjs exporting `{ format: { printWidth: 120 } }`.
// 2. Load it through LoadConfigResolver and read the formatPrintWidth options.
// 3. Assert `printWidth` decodes to 120 — proof `format` was not dropped.
func TestLoadRuleConfigJavaScriptConfigFileRoundTripsFormatBlock(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), `module.exports = {
    format: { printWidth: 120 },
  };`)

  resolver, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.cjs",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  raw := resolver.RuleOptions("formatPrintWidth")
  if len(raw) == 0 {
    t.Fatal("format block was dropped: formatPrintWidth has no options")
  }
  var opts struct {
    PrintWidth int `json:"printWidth"`
  }
  if err := json.Unmarshal(raw, &opts); err != nil {
    t.Fatalf("decode formatPrintWidth options: %v", err)
  }
  if opts.PrintWidth != 120 {
    t.Fatalf("printWidth want 120 (format block round-tripped), got %d", opts.PrintWidth)
  }
}
