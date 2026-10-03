package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestScriptConfigLoaderUnwrapsNestedDefault verifies transpiled CJS defaults.
//
// Some transpilers produce nested default objects for ESM-style config exports.
// The JavaScript loader accepts that shape with a bounded unwrap so banner
// configs authored as default exports survive CJS interop wrappers.
//
// 1. Export a CJS object whose banner lives under `default.text`.
// 2. Load it through the script config loader.
// 3. Assert the nested banner text is returned.
//
// @evidence contracts/testing.md#behavioral-verification Real Node imports CJS {default:{text:"nested default"}} and the banner loader returns nested default.
// @evidence contracts/testing.md#independent-expectations The authored inner text is the expectation for a transpiler default wrapper, independently of the unwrap implementation.
// @evidence contracts/testing.md#distinguishing-cases One nested wrapper is positive; sibling entries cover outer-text and ESM named/default precedence. The unwrap depth limit is not asserted.
// @evidence contracts/testing.md#execution-ownership The named banner Go entry calls its owning script loader through the test bridge and executes actual Node over the authored config file, without a native sidecar.
func TestScriptConfigLoaderUnwrapsNestedDefault(t *testing.T) {
  config := filepath.Join(t.TempDir(), "banner.config.cjs")
  shared.WriteFile(t, config, `module.exports = { default: { text: "nested default" } };`)

  raw, err := shared.BannerLoadBannerScriptConfigFile(config)
  if err != nil {
    t.Fatal(err)
  }
  object, ok := raw.(map[string]any)
  if !ok || object["text"] != "nested default" {
    t.Fatalf("nested default cjs config mismatch: %#v", raw)
  }
}
