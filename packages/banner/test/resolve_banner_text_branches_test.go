package banner_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestResolveBannerTextBranches verifies inline, explicit, discovered, and invalid config paths.
//
// The resolver decides which source of banner text wins before the compiler
// sees any preamble. This test keeps those choices explicit: inline text wins,
// explicit config paths are tsconfig-relative, and discovery is only used when
// no inline or explicit source exists.
//
// 1. Resolve inline text and inline validation errors.
// 2. Resolve explicit config files and reject malformed config declarations.
// 3. Resolve discovered config files and reject missing or unusable exports.
func TestResolveBannerTextBranches(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "project")
  tsconfig := filepath.Join(project, "tsconfig.json")
  writeFile(t, tsconfig, "{}")

  text, err := bannerResolveBannerText(map[string]any{"text": "inline"}, root, tsconfig)
  if text != "inline" || err != nil {
    t.Fatalf("inline resolve mismatch: text=%q err=%v", text, err)
  }
  if _, err := bannerResolveBannerText(map[string]any{"text": ""}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `"text" must be a non-empty string`) {
    t.Fatalf("expected inline validation error, got %v", err)
  }
  if _, err := bannerResolveBannerText(map[string]any{"config": 1}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `"config" must be a non-empty string path`) {
    t.Fatalf("expected config type error, got %v", err)
  }
  if _, err := bannerResolveBannerText(map[string]any{"config": " "}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `"config" must be a non-empty string path`) {
    t.Fatalf("expected blank config error, got %v", err)
  }

  explicit := filepath.Join(project, "banner.config.cjs")
  writeFile(t, explicit, `module.exports = { text: "explicit" };`)
  text, err = bannerResolveBannerText(map[string]any{"config": "banner.config.cjs"}, root, tsconfig)
  if text != "explicit" || err != nil {
    t.Fatalf("explicit config resolve mismatch: text=%q err=%v", text, err)
  }

  noText := filepath.Join(project, "banner.config.js")
  writeFile(t, noText, `export default { other: true };`)
  if _, err := bannerResolveBannerText(map[string]any{"config": "banner.config.js"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "config file must export") {
    t.Fatalf("expected explicit no-text export error, got %v", err)
  }
  emptyText := filepath.Join(project, "empty", "banner.config.cjs")
  writeFile(t, emptyText, `module.exports = "";`)
  if _, err := bannerResolveBannerText(map[string]any{"config": "empty/banner.config.cjs"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must be a non-empty string") {
    t.Fatalf("expected explicit empty-text export error, got %v", err)
  }
  fakeTtsx := writeExecutable(t, filepath.Join(root, "fake-ttsx"), "#!/bin/sh\nprintf '{}'\n")
  t.Setenv("TTSC_TTSX_BINARY", fakeTtsx)
  noTextTS := filepath.Join(project, "ts", "banner.config.ts")
  writeFile(t, noTextTS, `export default {};`)
  if _, err := bannerResolveBannerText(map[string]any{"config": "ts/banner.config.ts"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must export a non-empty string") {
    t.Fatalf("expected explicit ts no-text export error, got %v", err)
  }
  if _, err := bannerResolveBannerText(map[string]any{}, filepath.Join(root, "empty"), ""); err == nil || !strings.Contains(err.Error(), `"text" must be a non-empty string`) {
    t.Fatalf("expected missing text/config error, got %v", err)
  }

  discoveredRoot := filepath.Join(root, "discovered")
  discoveredProject := filepath.Join(discoveredRoot, "child")
  discoveredTsconfig := filepath.Join(discoveredProject, "tsconfig.json")
  writeFile(t, discoveredTsconfig, "{}")
  writeFile(t, filepath.Join(discoveredRoot, "banner.config.cjs"), `module.exports = "discovered";`)
  text, err = bannerResolveBannerText(map[string]any{}, discoveredRoot, discoveredTsconfig)
  if text != "discovered" || err != nil {
    t.Fatalf("discovered config resolve mismatch: text=%q err=%v", text, err)
  }
  writeFile(t, filepath.Join(discoveredProject, "banner.config.js"), `export default "one";`)
  writeFile(t, filepath.Join(discoveredProject, "banner.config.cjs"), `module.exports = "two";`)
  if _, err := bannerResolveBannerText(map[string]any{}, discoveredRoot, discoveredTsconfig); err == nil || !strings.Contains(err.Error(), "multiple banner.config") {
    t.Fatalf("expected discovered duplicate error, got %v", err)
  }

  badDiscoveredRoot := filepath.Join(root, "bad-discovered")
  badDiscoveredTsconfig := filepath.Join(badDiscoveredRoot, "tsconfig.json")
  writeFile(t, badDiscoveredTsconfig, "{}")
  writeFile(t, filepath.Join(badDiscoveredRoot, "banner.config.cjs"), `module.exports = 1;`)
  if _, err := bannerResolveBannerText(map[string]any{}, badDiscoveredRoot, badDiscoveredTsconfig); err == nil || !strings.Contains(err.Error(), "config file must export") {
    t.Fatalf("expected discovered loader error, got %v", err)
  }

  emptyDiscoveredRoot := filepath.Join(root, "empty-discovered")
  emptyDiscoveredTsconfig := filepath.Join(emptyDiscoveredRoot, "tsconfig.json")
  writeFile(t, emptyDiscoveredTsconfig, "{}")
  writeFile(t, filepath.Join(emptyDiscoveredRoot, "banner.config.cjs"), `module.exports = "";`)
  if _, err := bannerResolveBannerText(map[string]any{}, emptyDiscoveredRoot, emptyDiscoveredTsconfig); err == nil || !strings.Contains(err.Error(), "must be a non-empty string") {
    t.Fatalf("expected discovered empty string error, got %v", err)
  }

  noTextDiscoveredRoot := filepath.Join(root, "no-text-discovered")
  noTextDiscoveredTsconfig := filepath.Join(noTextDiscoveredRoot, "tsconfig.json")
  writeFile(t, noTextDiscoveredTsconfig, "{}")
  writeFile(t, filepath.Join(noTextDiscoveredRoot, "banner.config.ts"), `export default {};`)
  t.Setenv("TTSC_TTSX_BINARY", fakeTtsx)
  if _, err := bannerResolveBannerText(map[string]any{}, noTextDiscoveredRoot, noTextDiscoveredTsconfig); err == nil || !strings.Contains(err.Error(), "must export a non-empty string") {
    t.Fatalf("expected discovered no-text export error, got %v", err)
  }
}
