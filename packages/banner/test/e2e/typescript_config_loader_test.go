//go:build e2e

package banner_test

import (
  "encoding/json"
  "path/filepath"
  "runtime"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestTypeScriptConfigLoader verifies TypeScript banner.config loading branches.
//
// TypeScript config files run through ttsx, with JavaScript launcher files
// routed through node and executable binaries run directly. Fake launchers keep
// this test focused on the command construction and JSON contract instead of
// recompiling a real config fixture for every error branch.
//
// 1. Load .ts and .mts configs through node-routed and direct ttsx launchers.
// 2. Assert generated tsconfig, relative imports and launcher argument routing.
// 3. Cover invalid stdout, stderr exits, silent exits, and tempdir failures.
//
// @evidence contracts/testing.md#behavioral-verification The actual native file preparation and TypeScript config loader must route JavaScript and direct fixture launchers, decode dependency-observation envelopes and report malformed output, nonzero or silent exit, relative-import failure and tempdir failure with their original context.
// @evidence contracts/testing.md#independent-expectations Authored child programs emit distinct literal from-ts/from-direct values or intentional invalid bytes/statuses; config path and supported diagnostic labels determine expectations independently, and these launchers do not evaluate the authored TypeScript config.
// @evidence contracts/testing.md#distinguishing-cases Node-routed versus direct launchers, dispatcher versus direct loading, environment-pinned versus bare command arguments, same/parent/invalid imports, malformed payload, stderr versus silent exit and non-directory tempbase remain; injected preparation failures belong to the direct preparation unit.
// @evidence contracts/testing.md#execution-ownership The function runs the real loader's filesystem preparation and spawns fixture launchers as child processes (a node-routed .mjs and direct executables); it also calls pure helpers directly (launcher extension classification, ttsxCommand arguments, loader tsconfig files, relative import specifiers). TestTypeScriptConfigLoaderPrecedence runs the generated loader source.
// @evidence contracts/e2e.md#necessary-boundary Files written by the native preparation adapter, launcher selection, real process status and stdout-envelope decoding must cooperate; source-unit I/O outcomes do not establish this transport or that user-facing stderr is separate from the returned error.
// @evidence contracts/e2e.md#shared-execution The Go test process shares compiled driver source and fixture launchers; each actual loader invocation owns its temporary project and child because selected launcher, payload or exit state changes, without rebuilding a native plugin for each branch.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir and t.Setenv isolate files and tool/temp variables; the actual loader releases its temporary tree after each invocation and waits for its child. Global link/write replacement is absent; the production caller supplies native operations explicitly.
// @evidence contracts/e2e.md#preserved-coverage The body asserts node-routed, dispatcher and direct-launcher loads, launcher extension classification, ttsxCommand argument layout for node-routed, direct and bare launchers, loader tsconfig files, same-dir/parent/invalid relative specifiers, the relative-import load error, invalid-stdout, exit-status-8 (without echoing child stderr), silent-exit and temp-directory-creation errors; link/write failure injection lives in the unit TestTypeScriptConfigLoaderPreparationReportsIOFailures.
func TestTypeScriptConfigLoader(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "banner.config.ts")
  shared.WriteFile(t, config, `export default { text: "ignored by fake ttsx" };`)

  nodeLauncher := writeExecutable(t, filepath.Join(root, "fake-ttsx.mjs"), `process.stdout.write(JSON.stringify({ complete: true, inputs: [], hashes: {}, realpaths: {}, value: { text: "from ts" } }));`+"\n")
  t.Setenv("TTSC_TTSX_BINARY", nodeLauncher)
  t.Setenv("TTSC_TSGO_BINARY", filepath.Join(root, "tsgo"))
  raw, err := shared.BannerLoadBannerTypeScriptConfigFile(config, root)
  if err != nil {
    t.Fatal(err)
  }
  object, ok := raw.(map[string]any)
  if !ok || object["text"] != "from ts" {
    t.Fatalf("node-routed ts config mismatch: %#v", raw)
  }
  raw, err = shared.BannerLoadBannerConfigFile(config, root)
  if err != nil {
    t.Fatal(err)
  }
  object, ok = raw.(map[string]any)
  if !ok || object["text"] != "from ts" {
    t.Fatalf("dispatcher ts config mismatch: %#v", raw)
  }

  directLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx"), `{"complete":true,"inputs":[],"hashes":{},"realpaths":{},"value":{"text":"from direct"}}`, "", 0)
  t.Setenv("TTSC_TTSX_BINARY", directLauncher)
  raw, err = shared.BannerLoadBannerTypeScriptConfigFile(filepath.Join(root, "banner.config.mts"), root)
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
  cmd := shared.BannerTtsxCommand(nil, "--project", "tsconfig.json")
  if len(cmd.Args) < 3 || cmd.Args[1] != nodeLauncher || cmd.Args[2] != "--project" {
    t.Fatalf("node-routed ttsx command mismatch: %#v", cmd.Args)
  }
  t.Setenv("TTSC_TTSX_BINARY", directLauncher)
  cmd = shared.BannerTtsxCommand(nil, "--project", "tsconfig.json")
  if len(cmd.Args) < 2 || cmd.Args[0] != directLauncher || cmd.Args[1] != "--project" {
    t.Fatalf("direct ttsx command mismatch: %#v", cmd.Args)
  }
  t.Setenv("TTSC_TTSX_BINARY", "")
  cmd = shared.BannerTtsxCommand(nil, "--project", "tsconfig.json")
  if len(cmd.Args) < 2 || cmd.Args[0] != "ttsx" || cmd.Args[1] != "--project" {
    t.Fatalf("default ttsx command mismatch: %#v", cmd.Args)
  }

  tsconfigText := shared.BannerTypeScriptConfigLoaderTsconfig("/loader.mts", "/banner.config.ts", root)
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
  if _, err := shared.BannerLoadBannerTypeScriptConfigFile("banner.config.ts", root); err == nil || !strings.Contains(err.Error(), "resolve relative config import") {
    t.Fatalf("expected relative import error, got %v", err)
  }

  invalidJSONLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx-invalid"), "not-json", "", 0)
  t.Setenv("TTSC_TTSX_BINARY", invalidJSONLauncher)
  if _, err := shared.BannerLoadBannerTypeScriptConfigFile(config, root); err == nil || !strings.Contains(err.Error(), "parse TypeScript config file") {
    t.Fatalf("expected invalid stdout error, got %v", err)
  }
  // A loader that writes to stderr sends that text straight to this process's
  // stderr as it runs, so it is never collected and cannot be repeated in the
  // error. What the error owes the caller is which config failed and how the
  // process ended.
  stderrLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx-stderr"), "", "ts failed", 8)
  t.Setenv("TTSC_TTSX_BINARY", stderrLauncher)
  err = nil
  if _, err = shared.BannerLoadBannerTypeScriptConfigFile(config, root); err == nil ||
    !strings.Contains(err.Error(), "load TypeScript config file") ||
    !strings.Contains(err.Error(), config) ||
    !strings.Contains(err.Error(), "exit status 8") {
    t.Fatalf("expected a named non-zero exit, got %v", err)
  }
  if strings.Contains(err.Error(), "ts failed") {
    t.Fatalf("loader stderr must reach the user directly, not the error: %v", err)
  }
  silentLauncher := writeDirectLauncher(t, filepath.Join(root, "fake-ttsx-silent"), "", "", 8)
  t.Setenv("TTSC_TTSX_BINARY", silentLauncher)
  if _, err := shared.BannerLoadBannerTypeScriptConfigFile(config, root); err == nil || !strings.Contains(err.Error(), "exit status") {
    t.Fatalf("expected silent exit error, got %v", err)
  }
  badTmp := filepath.Join(root, "not-a-directory")
  shared.WriteFile(t, badTmp, "file")
  // os.TempDir reads TMP/TEMP on Windows and TMPDIR elsewhere.
  if runtime.GOOS == "windows" {
    t.Setenv("TMP", badTmp)
    t.Setenv("TEMP", badTmp)
  } else {
    t.Setenv("TMPDIR", badTmp)
  }
  if _, err := shared.BannerLoadBannerTypeScriptConfigFile(config, root); err == nil || !strings.Contains(err.Error(), "create config loader tempdir") {
    t.Fatalf("expected tempdir error, got %v", err)
  }
}
