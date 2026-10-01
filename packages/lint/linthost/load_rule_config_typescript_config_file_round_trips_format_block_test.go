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
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver returns nonempty format/semi options decoding to prefer never from the typed format-only module.
// @evidence contracts/testing.md#independent-expectations The authored semi false fixture independently requires the never option contract.
// @evidence contracts/testing.md#distinguishing-cases Owns typed format-only transport; CJS transport and rule severities are separate cases.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigTypeScriptConfigFileRoundTripsFormatBlock is physically owned by test/e2e/config and called once with its unchanged name under TestSelectedLintBoundaries; all existing assertions and helpers remain in the flat Go overlay.
// @evidence contracts/e2e.md#necessary-boundary Actual typed evaluator serialization must preserve format through the Go resolver option channel.
// @evidence contracts/e2e.md#shared-execution One typed format-only request shares existing ttsx/compiler artifacts and the one Go harness.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns each mutable fixture and t.Setenv restores changed environment; the production evaluator waits for each child and defers scratch removal and context cancellation on return; an external process kill cannot guarantee deferred cleanup. Distinct absolute config identities prevent cross-case cached answers, while intentional mutation and recovery states remain observable.
// @evidence contracts/e2e.md#preserved-coverage Every original fixture, test-function body, assertion and helper is retained byte-for-byte; portable config units keep their separate selection and this move only makes the existing real boundary ownership physical.
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
  raw := resolver.RuleOptions("format/semi")
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
