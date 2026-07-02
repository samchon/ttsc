package banner_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestResolveBannerTextBranches verifies configFile, discovered, and invalid config paths.
//
// The resolver decides which source of banner text wins before the compiler
// sees any preamble. This test keeps those choices explicit: explicit configFile
// paths are tsconfig-relative, and discovery is only used when no configFile key
// is present. Unknown keys in the config are rejected immediately.
//
// 1. Reject unknown tsconfig plugin entry keys and invalid configFile values.
// 2. Resolve explicit configFile paths and reject malformed declarations.
// 3. Resolve discovered config files and reject missing or unusable exports.
func TestResolveBannerTextBranches(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "project")
  tsconfig := filepath.Join(project, "tsconfig.json")
  writeFile(t, tsconfig, "{}")

  // Unknown key rejection.
  if _, err := bannerResolveBannerText(map[string]any{"text": "inline"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `unsupported key "text"`) {
    t.Fatalf("expected unsupported key error for \"text\", got %v", err)
  }
  if _, err := bannerResolveBannerText(map[string]any{"config": "banner.config.cjs"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `unsupported key "config"`) {
    t.Fatalf("expected unsupported key error for \"config\", got %v", err)
  }

  // Framework keys pass through without error even when no config file exists.
  for _, key := range []string{"transform", "name", "stage", "enabled"} {
    config := map[string]any{key: "value"}
    _, err := bannerResolveBannerText(config, filepath.Join(root, "empty"), "")
    if err != nil && strings.Contains(err.Error(), `unsupported key`) {
      t.Fatalf("framework key %q should not be rejected, got %v", key, err)
    }
  }

  // Invalid configFile type and blank value.
  if _, err := bannerResolveBannerText(map[string]any{"configFile": 1}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `"configFile" must be a non-empty string path`) {
    t.Fatalf("expected configFile type error, got %v", err)
  }
  if _, err := bannerResolveBannerText(map[string]any{"configFile": " "}, root, tsconfig); err == nil || !strings.Contains(err.Error(), `"configFile" must be a non-empty string path`) {
    t.Fatalf("expected blank configFile error, got %v", err)
  }

  // Explicit configFile resolution against tsconfig directory.
  explicit := filepath.Join(project, "banner.config.cjs")
  writeFile(t, explicit, `module.exports = { text: "explicit" };`)
  text, err := bannerResolveBannerText(map[string]any{"configFile": "banner.config.cjs"}, root, tsconfig)
  if text != "explicit" || err != nil {
    t.Fatalf("explicit configFile resolve mismatch: text=%q err=%v", text, err)
  }

  // Explicit configFile pointing at a config that exports no text (object without "text" key).
  // The Node script throws "config file must export an object" and the discovered-path
  // raises "must export an object" — the common substring is "must export an object".
  noText := filepath.Join(project, "no-text", "banner.config.cjs")
  writeFile(t, noText, `module.exports = { other: true };`)
  if _, err := bannerResolveBannerText(map[string]any{"configFile": "no-text/banner.config.cjs"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must export an object") {
    t.Fatalf("expected explicit no-text export error, got %v", err)
  }

  // A bare-string export is rejected: a banner config must be an object.
  bareString := filepath.Join(project, "bare", "banner.config.cjs")
  writeFile(t, bareString, `module.exports = "bare";`)
  if _, err := bannerResolveBannerText(map[string]any{"configFile": "bare/banner.config.cjs"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must export an object") {
    t.Fatalf("expected explicit bare-string export error, got %v", err)
  }

  emptyText := filepath.Join(project, "empty", "banner.config.cjs")
  writeFile(t, emptyText, `module.exports = { text: "" };`)
  if _, err := bannerResolveBannerText(map[string]any{"configFile": "empty/banner.config.cjs"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must be a non-empty string") {
    t.Fatalf("expected explicit empty-text export error, got %v", err)
  }

  fakeTtsx := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx"), "{}", "", 0)
  t.Setenv("TTSC_TTSX_BINARY", fakeTtsx)
  noTextTS := filepath.Join(project, "ts", "banner.config.ts")
  writeFile(t, noTextTS, `export default {};`)
  if _, err := bannerResolveBannerText(map[string]any{"configFile": "ts/banner.config.ts"}, root, tsconfig); err == nil || !strings.Contains(err.Error(), "must export an object") {
    t.Fatalf("expected explicit ts no-text export error, got %v", err)
  }

  // Auto-discovery: missing config file.
  if _, err := bannerResolveBannerText(map[string]any{}, filepath.Join(root, "empty"), ""); err == nil || !strings.Contains(err.Error(), "no banner.config") {
    t.Fatalf("expected missing config error, got %v", err)
  }

  // Auto-discovery: happy path.
  discoveredRoot := filepath.Join(root, "discovered")
  discoveredProject := filepath.Join(discoveredRoot, "child")
  discoveredTsconfig := filepath.Join(discoveredProject, "tsconfig.json")
  writeFile(t, discoveredTsconfig, "{}")
  writeFile(t, filepath.Join(discoveredRoot, "banner.config.cjs"), `module.exports = { text: "discovered" };`)
  text, err = bannerResolveBannerText(map[string]any{}, discoveredRoot, discoveredTsconfig)
  if text != "discovered" || err != nil {
    t.Fatalf("discovered config resolve mismatch: text=%q err=%v", text, err)
  }

  // Auto-discovery: ambiguous (duplicate) config files.
  writeFile(t, filepath.Join(discoveredProject, "banner.config.js"), `export default { text: "one" };`)
  writeFile(t, filepath.Join(discoveredProject, "banner.config.cjs"), `module.exports = { text: "two" };`)
  if _, err := bannerResolveBannerText(map[string]any{}, discoveredRoot, discoveredTsconfig); err == nil || !strings.Contains(err.Error(), "multiple banner config files") {
    t.Fatalf("expected discovered duplicate error, got %v", err)
  }

  // Auto-discovery: bad export.
  badDiscoveredRoot := filepath.Join(root, "bad-discovered")
  badDiscoveredTsconfig := filepath.Join(badDiscoveredRoot, "tsconfig.json")
  writeFile(t, badDiscoveredTsconfig, "{}")
  writeFile(t, filepath.Join(badDiscoveredRoot, "banner.config.cjs"), `module.exports = 1;`)
  if _, err := bannerResolveBannerText(map[string]any{}, badDiscoveredRoot, badDiscoveredTsconfig); err == nil || !strings.Contains(err.Error(), "config file must export") {
    t.Fatalf("expected discovered loader error, got %v", err)
  }

  // Auto-discovery: empty "text" export.
  emptyDiscoveredRoot := filepath.Join(root, "empty-discovered")
  emptyDiscoveredTsconfig := filepath.Join(emptyDiscoveredRoot, "tsconfig.json")
  writeFile(t, emptyDiscoveredTsconfig, "{}")
  writeFile(t, filepath.Join(emptyDiscoveredRoot, "banner.config.cjs"), `module.exports = { text: "" };`)
  if _, err := bannerResolveBannerText(map[string]any{}, emptyDiscoveredRoot, emptyDiscoveredTsconfig); err == nil || !strings.Contains(err.Error(), "must be a non-empty string") {
    t.Fatalf("expected discovered empty text error, got %v", err)
  }

  // Auto-discovery: TypeScript config with no text.
  noTextDiscoveredRoot := filepath.Join(root, "no-text-discovered")
  noTextDiscoveredTsconfig := filepath.Join(noTextDiscoveredRoot, "tsconfig.json")
  writeFile(t, noTextDiscoveredTsconfig, "{}")
  writeFile(t, filepath.Join(noTextDiscoveredRoot, "banner.config.ts"), `export default {};`)
  t.Setenv("TTSC_TTSX_BINARY", fakeTtsx)
  if _, err := bannerResolveBannerText(map[string]any{}, noTextDiscoveredRoot, noTextDiscoveredTsconfig); err == nil || !strings.Contains(err.Error(), "must export an object") {
    t.Fatalf("expected discovered no-text export error, got %v", err)
  }
}
