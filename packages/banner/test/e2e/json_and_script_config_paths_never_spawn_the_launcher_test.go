package banner_test

import (
  "path/filepath"
  "testing"
)

// TestJSONAndScriptConfigPathsNeverSpawnTheLauncher verifies the non-TypeScript
// config shapes are untouched by the toolchain resolution.
//
// Only `banner.config.{ts,cts,mts}` spawns ttsx; `.json` is parsed in-process
// and `.js/.cjs/.mjs` run under Node alone. Both variables therefore point at
// paths that cannot be spawned: if the dispatcher ever routed either shape
// through the ttsx branch, or the resolution leaked into the Node branch, the
// load would fail instead of returning the config.
//
//  1. Pin both tool variables at paths that do not exist.
//  2. Load a `.json` and a `.cjs` config through the dispatcher.
//  3. Assert both return their text with no spawn failure.
// @evidence contracts/testing.md#behavioral-verification The banner loader reads JSON and evaluates script config successfully while compiler and ttsx variables name nonexistent files; returned values must match the authored exports.
// @evidence contracts/testing.md#independent-expectations The literal config data is the expectation, and nonexistent pinned TS tools make erroneous routing through ttsx fail.
// @evidence contracts/testing.md#distinguishing-cases JSON loads directly, whereas script uses actual Node import. The case tests TS-tool avoidance, not absence of Node or TypeScript source evaluation.
// @evidence contracts/testing.md#execution-ownership This named entry mixes direct JSON parsing with a real Node script child; no native utility producer or consumer compiler executes.
// @evidence contracts/e2e.md#necessary-boundary Only the script import-to-returned-value connection needs Node. JSON parsing is a direct unit concern; the mixed E2E label does not make its filesystem read a necessary boundary.
// @evidence contracts/e2e.md#shared-execution Two files share one root and only the script starts Node. No Go build or compiler preparation occurs.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.Setenv restores pinned tools, t.TempDir releases files and the script child finishes before load returns. No cached value bypasses the observation.
// @evidence contracts/e2e.md#preserved-coverage Both original value assertions and unusable-tool inputs remain. They prove JSON/script dispatch without ttsx, not real TypeScript evaluation.
func TestJSONAndScriptConfigPathsNeverSpawnTheLauncher(t *testing.T) {
  root := bannerRealpathIfPossible(t.TempDir())
  t.Setenv("TTSC_TSGO_BINARY", filepath.Join(root, "absent", "tsc"))
  t.Setenv("TTSC_TTSX_BINARY", filepath.Join(root, "absent", "ttsx.js"))

  jsonConfig := filepath.Join(root, "banner.config.json")
  writeFile(t, jsonConfig, `{"text":"from json"}`)
  raw, err := bannerLoadBannerConfigFile(jsonConfig, root)
  if err != nil {
    t.Fatalf("json config load failed with an unspawnable launcher pinned: %v", err)
  }
  object, ok := raw.(map[string]any)
  if !ok || object["text"] != "from json" {
    t.Fatalf("json config mismatch: %#v", raw)
  }

  scriptConfig := filepath.Join(root, "script", "banner.config.cjs")
  writeFile(t, scriptConfig, "module.exports = { text: \"from cjs\" };\n")
  raw, err = bannerLoadBannerConfigFile(scriptConfig, root)
  if err != nil {
    t.Fatalf("cjs config load failed with an unspawnable launcher pinned: %v", err)
  }
  object, ok = raw.(map[string]any)
  if !ok || object["text"] != "from cjs" {
    t.Fatalf("cjs config mismatch: %#v", raw)
  }
}
