package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestScriptConfigLoaderPrefersDefaultExportOverNamedText verifies ESM default precedence.
//
// Banner configs commonly use `export default { text }`. A named `text` export
// may exist as a helper constant in the same module, but it must not override
// the default config object. This preserves the loader precedence from before
// nested CJS default unwrapping was added.
//
// 1. Export a named `text` helper and a default banner object.
// 2. Load it through the script config loader.
// 3. Assert the default export wins.
// @evidence contracts/testing.md#behavioral-verification Real Node imports MJS with named text="named" and default {text:"default"}; the loader must return default.
// @evidence contracts/testing.md#independent-expectations The supported ESM default config wins over the helper named export; differing literals independently detect namespace selection errors.
// @evidence contracts/testing.md#distinguishing-cases Named/default competition differs from a plain default object and from CJS outer-text precedence, each owned by sibling cases.
// @evidence contracts/testing.md#execution-ownership The named banner Go entry calls its owning script loader through the test bridge and executes actual Node over the authored config file, without a native sidecar.
// @evidence contracts/e2e.md#necessary-boundary CJS/ESM namespace selection and export serialization cross actual Node. These sibling decisions still use independent Node consumers, so minimum resident batching has not been established.
// @evidence contracts/e2e.md#shared-execution One temporary config and one Node import are prepared without Go producer or compiler. A shared batch must retain this exact competing export shape.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns the config and the child finishes before load returns. Separate process state prevents sibling module-cache contamination; no artifact cache is claimed.
// @evidence contracts/e2e.md#preserved-coverage The body asserts a nil error and a returned object whose text equals 'default' (L35); one assertion shape, no generic load-success check.
func TestScriptConfigLoaderPrefersDefaultExportOverNamedText(t *testing.T) {
  config := filepath.Join(t.TempDir(), "banner.config.mjs")
  shared.WriteFile(t, config, `export const text = "named"; export default { text: "default" };`)

  raw, err := bannerLoadBannerScriptConfigFile(config)
  if err != nil {
    t.Fatal(err)
  }
  object, ok := raw.(map[string]any)
  if !ok || object["text"] != "default" {
    t.Fatalf("script config should prefer default export: %#v", raw)
  }
}
