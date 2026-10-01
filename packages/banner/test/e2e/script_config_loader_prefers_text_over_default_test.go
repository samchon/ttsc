package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestScriptConfigLoaderPrefersTextOverDefault verifies explicit banner object wins.
//
// JavaScript configs may carry helper fields alongside `text`. A bounded
// default-unwrapping loop is needed for transpiled module shapes, but once the
// current value is already a banner object it must not chase a nested `default`
// field and silently replace the user's explicit banner.
//
// 1. Export a CJS object with both `text` and `default.text`.
// 2. Load it through the script config loader.
// 3. Assert the top-level `text` is used.
// @evidence contracts/testing.md#behavioral-verification Real Node imports CJS {text:"outer",default:{text:"inner"}} and must return outer.
// @evidence contracts/testing.md#independent-expectations Explicit top-level banner text wins over its helper default field; distinct authored strings reject excessive unwrapping.
// @evidence contracts/testing.md#distinguishing-cases Competing text at two levels distinguishes stopping at a banner object from following default. A wrapper without outer text is covered separately.
// @evidence contracts/testing.md#execution-ownership The named banner Go entry calls its owning script loader through the test bridge and executes actual Node over the authored config file, without a native sidecar.
// @evidence contracts/e2e.md#necessary-boundary CJS/ESM namespace selection and export serialization cross actual Node. These sibling decisions still use independent Node consumers, so minimum resident batching has not been established.
// @evidence contracts/e2e.md#shared-execution One temporary config and one Node import are prepared without Go producer or compiler. A shared batch must retain this exact competing export shape.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns the config and the child finishes before load returns. Separate process state prevents sibling module-cache contamination; no artifact cache is claimed.
// @evidence contracts/e2e.md#preserved-coverage The body asserts a nil error and a returned object whose text equals 'outer' (L35).
func TestScriptConfigLoaderPrefersTextOverDefault(t *testing.T) {
  config := filepath.Join(t.TempDir(), "banner.config.cjs")
  shared.WriteFile(t, config, `module.exports = { text: "outer", default: { text: "inner" } };`)

  raw, err := bannerLoadBannerScriptConfigFile(config)
  if err != nil {
    t.Fatal(err)
  }
  object, ok := raw.(map[string]any)
  if !ok || object["text"] != "outer" {
    t.Fatalf("script config should prefer top-level text: %#v", raw)
  }
}
