package banner_test

import (
  "encoding/json"
  "errors"
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// TestTypeScriptConfigLoader verifies TypeScript banner.config loading branches.
//
// TypeScript config files run through ttsx, with JavaScript launcher files
// routed through node and executable binaries run directly. Fake launchers keep
// this test focused on the command construction and JSON contract instead of
// recompiling a real config fixture for every error branch.
//
// 1. Load .ts and .mts configs through node-routed and direct ttsx launchers.
// 2. Assert loader source, generated tsconfig, and relative import formatting.
// 3. Cover invalid stdout, stderr exits, silent exits, and tempdir failures.
func TestTypeScriptConfigLoader(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "banner.config.ts")
  writeFile(t, config, `export default { text: "ignored by fake ttsx" };`)

  nodeLauncher := writeExecutable(t, filepath.Join(root, "fake-ttsx.mjs"), `process.stdout.write(JSON.stringify({ text: "from ts" }));`+"\n")
  t.Setenv("TTSC_TTSX_BINARY", nodeLauncher)
  t.Setenv("TTSC_TSGO_BINARY", filepath.Join(root, "tsgo"))
  raw, err := bannerLoadBannerTypeScriptConfigFile(config)
  if err != nil {
    t.Fatal(err)
  }
  object, ok := raw.(map[string]any)
  if !ok || object["text"] != "from ts" {
    t.Fatalf("node-routed ts config mismatch: %#v", raw)
  }
  raw, err = bannerLoadBannerConfigFile(config)
  if err != nil {
    t.Fatal(err)
  }
  object, ok = raw.(map[string]any)
  if !ok || object["text"] != "from ts" {
    t.Fatalf("dispatcher ts config mismatch: %#v", raw)
  }

  directLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx"), `{"text":"from direct"}`, "", 0)
  t.Setenv("TTSC_TTSX_BINARY", directLauncher)
  raw, err = bannerLoadBannerTypeScriptConfigFile(filepath.Join(root, "banner.config.mts"))
  if err != nil {
    t.Fatal(err)
  }
  object, ok = raw.(map[string]any)
  if !ok || object["text"] != "from direct" {
    t.Fatalf("direct ts config mismatch: %#v", raw)
  }

  if !bannerShouldRunTtsxThroughNode("loader.ts") || !bannerShouldRunTtsxThroughNode("loader.cjs") || bannerShouldRunTtsxThroughNode("ttsx") {
    t.Fatal("ttsx launcher extension classification mismatch")
  }
  t.Setenv("TTSC_TTSX_BINARY", nodeLauncher)
  cmd := bannerTtsxCommand("--project", "tsconfig.json")
  if len(cmd.Args) < 3 || cmd.Args[1] != nodeLauncher || cmd.Args[2] != "--project" {
    t.Fatalf("node-routed ttsx command mismatch: %#v", cmd.Args)
  }
  t.Setenv("TTSC_TTSX_BINARY", directLauncher)
  cmd = bannerTtsxCommand("--project", "tsconfig.json")
  if len(cmd.Args) < 2 || cmd.Args[0] != directLauncher || cmd.Args[1] != "--project" {
    t.Fatalf("direct ttsx command mismatch: %#v", cmd.Args)
  }
  t.Setenv("TTSC_TTSX_BINARY", "")
  cmd = bannerTtsxCommand("--project", "tsconfig.json")
  if len(cmd.Args) < 2 || cmd.Args[0] != "ttsx" || cmd.Args[1] != "--project" {
    t.Fatalf("default ttsx command mismatch: %#v", cmd.Args)
  }

  source := bannerTypeScriptConfigLoaderSource(`"./banner.config.ts"`)
  if !strings.Contains(source, `import * as importedConfig from "./banner.config.ts";`) || !strings.Contains(source, "resolveConfig") {
    t.Fatalf("loader source mismatch:\n%s", source)
  }
  tsconfigText := bannerTypeScriptConfigLoaderTsconfig("/loader.mts", "/banner.config.ts", root)
  var tsconfig map[string]any
  if err := json.Unmarshal([]byte(tsconfigText), &tsconfig); err != nil {
    t.Fatal(err)
  }
  files, ok := tsconfig["files"].([]any)
  if !ok || len(files) != 2 || files[0] != "/loader.mts" || files[1] != "/banner.config.ts" {
    t.Fatalf("loader tsconfig files mismatch: %#v", tsconfig["files"])
  }
  if specifier, err := bannerRelativeImportSpecifier(root, filepath.Join(root, "banner.config.ts")); err != nil || specifier != "./banner.config.ts" {
    t.Fatalf("same-dir import mismatch: specifier=%q err=%v", specifier, err)
  }
  if specifier, err := bannerRelativeImportSpecifier(filepath.Join(root, "nested"), filepath.Join(root, "banner.config.ts")); err != nil || specifier != "../banner.config.ts" {
    t.Fatalf("parent import mismatch: specifier=%q err=%v", specifier, err)
  }
  if _, err := bannerRelativeImportSpecifier("", filepath.Join(root, "banner.config.ts")); err == nil {
    t.Fatal("expected invalid relative import base to fail")
  }
  if _, err := bannerLoadBannerTypeScriptConfigFile("banner.config.ts"); err == nil || !strings.Contains(err.Error(), "resolve relative config import") {
    t.Fatalf("expected relative import error, got %v", err)
  }

  originalLink := bannerLinkConfigNodeModules
  t.Cleanup(func() { bannerLinkConfigNodeModules = originalLink })
  bannerLinkConfigNodeModules = func(string, string) error {
    return errors.New("link failed")
  }
  if _, err := bannerLoadBannerTypeScriptConfigFile(config); err == nil || !strings.Contains(err.Error(), "link failed") {
    t.Fatalf("expected link error, got %v", err)
  }
  bannerLinkConfigNodeModules = originalLink

  originalWrite := bannerWriteConfigLoaderFile
  t.Cleanup(func() { bannerWriteConfigLoaderFile = originalWrite })
  bannerWriteConfigLoaderFile = func(string, []byte, os.FileMode) error {
    return errors.New("loader write failed")
  }
  if _, err := bannerLoadBannerTypeScriptConfigFile(config); err == nil || !strings.Contains(err.Error(), "write config loader") {
    t.Fatalf("expected loader write error, got %v", err)
  }
  calls := 0
  bannerWriteConfigLoaderFile = func(name string, data []byte, mode os.FileMode) error {
    calls++
    if calls == 2 {
      return errors.New("tsconfig write failed")
    }
    return os.WriteFile(name, data, mode)
  }
  if _, err := bannerLoadBannerTypeScriptConfigFile(config); err == nil || !strings.Contains(err.Error(), "write config loader tsconfig") {
    t.Fatalf("expected tsconfig write error, got %v", err)
  }
  bannerWriteConfigLoaderFile = originalWrite

  invalidJSONLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx-invalid"), "not-json", "", 0)
  t.Setenv("TTSC_TTSX_BINARY", invalidJSONLauncher)
  if _, err := bannerLoadBannerTypeScriptConfigFile(config); err == nil || !strings.Contains(err.Error(), "parse TypeScript config file") {
    t.Fatalf("expected invalid stdout error, got %v", err)
  }
  stderrLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx-stderr"), "", "ts failed", 8)
  t.Setenv("TTSC_TTSX_BINARY", stderrLauncher)
  if _, err := bannerLoadBannerTypeScriptConfigFile(config); err == nil || !strings.Contains(err.Error(), "ts failed") {
    t.Fatalf("expected stderr error, got %v", err)
  }
  silentLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx-silent"), "", "", 8)
  t.Setenv("TTSC_TTSX_BINARY", silentLauncher)
  if _, err := bannerLoadBannerTypeScriptConfigFile(config); err == nil || !strings.Contains(err.Error(), "exit status") {
    t.Fatalf("expected silent exit error, got %v", err)
  }
  badTmp := filepath.Join(root, "not-a-directory")
  writeFile(t, badTmp, "file")
  // os.TempDir reads TMP/TEMP on Windows and TMPDIR elsewhere.
  if runtime.GOOS == "windows" {
    t.Setenv("TMP", badTmp)
    t.Setenv("TEMP", badTmp)
  } else {
    t.Setenv("TMPDIR", badTmp)
  }
  if _, err := bannerLoadBannerTypeScriptConfigFile(config); err == nil || !strings.Contains(err.Error(), "create config loader tempdir") {
    t.Fatalf("expected tempdir error, got %v", err)
  }
}
