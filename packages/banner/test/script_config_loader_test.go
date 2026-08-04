package banner_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestScriptConfigLoader verifies JavaScript banner.config loading success and failures.
//
// The script loader is the runtime path for js, cjs, and mjs config files. The
// test uses real Node for valid exports, then swaps in small fake node binaries
// to pin process-output parsing and exit-error diagnostics without depending on
// a particular JavaScript stack trace.
//
// 1. Load cjs and mjs configs through the public config-file dispatcher.
// 2. Reject an invalid file name and an invalid JavaScript export.
// 3. Assert bad loader stdout, stderr, and silent exits produce loader errors.
func TestScriptConfigLoader(t *testing.T) {
  root := t.TempDir()
  cjs := filepath.Join(root, "banner.config.cjs")
  mjs := filepath.Join(root, "banner.config.mjs")
  writeFile(t, cjs, `module.exports = async () => ({ text: "from cjs" });`)
  writeFile(t, mjs, `export default { text: "from mjs" };`)

  raw, err := bannerLoadBannerConfigFile(cjs)
  if err != nil {
    t.Fatal(err)
  }
  object, ok := raw.(map[string]any)
  if !ok || object["text"] != "from cjs" {
    t.Fatalf("cjs config mismatch: %#v", raw)
  }
  raw, err = bannerLoadBannerScriptConfigFile(mjs)
  if err != nil {
    t.Fatal(err)
  }
  object, ok = raw.(map[string]any)
  if !ok || object["text"] != "from mjs" {
    t.Fatalf("mjs config mismatch: %#v", raw)
  }
  if _, err := bannerLoadBannerConfigFile(filepath.Join(root, "other.cjs")); err == nil || !strings.Contains(err.Error(), "config file must be named") {
    t.Fatalf("expected invalid name error, got %v", err)
  }

  badExport := filepath.Join(root, "bad", "banner.config.cjs")
  writeFile(t, badExport, `module.exports = 1;`)
  if _, err := bannerLoadBannerScriptConfigFile(badExport); err == nil || !strings.Contains(err.Error(), "config file must export") {
    t.Fatalf("expected invalid export error, got %v", err)
  }

  invalidJSONNode := writeDirectLauncher(t, filepath.Join(root, "fake-node-invalid-json"), "not-json", "", 0)
  t.Setenv("TTSC_NODE_BINARY", invalidJSONNode)
  if _, err := bannerLoadBannerScriptConfigFile(cjs); err == nil || !strings.Contains(err.Error(), "parse config file") {
    t.Fatalf("expected invalid stdout error, got %v", err)
  }

  // A loader that writes to stderr sends that text straight to this process's
  // stderr as it runs, so it is never collected and cannot be repeated in the
  // error. What the error owes the caller is which config failed and how the
  // process ended.
  stderrNode := writeDirectLauncher(t, filepath.Join(root, "fake-node-stderr"), "", "loader failed", 7)
  t.Setenv("TTSC_NODE_BINARY", stderrNode)
  stderrErr := error(nil)
  if _, stderrErr = bannerLoadBannerScriptConfigFile(cjs); stderrErr == nil ||
    !strings.Contains(stderrErr.Error(), "load config file") ||
    !strings.Contains(stderrErr.Error(), "exit status 7") {
    t.Fatalf("expected a named non-zero exit, got %v", stderrErr)
  }
  if strings.Contains(stderrErr.Error(), "loader failed") {
    t.Fatalf("loader stderr must reach the user directly, not the error: %v", stderrErr)
  }

  silentNode := writeDirectLauncher(t, filepath.Join(root, "fake-node-silent"), "", "", 7)
  t.Setenv("TTSC_NODE_BINARY", silentNode)
  if _, err := bannerLoadBannerScriptConfigFile(cjs); err == nil || !strings.Contains(err.Error(), "exit status") {
    t.Fatalf("expected silent exit error, got %v", err)
  }
}
