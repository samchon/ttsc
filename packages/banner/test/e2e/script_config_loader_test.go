//go:build e2e

package banner_test

import (
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
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
//
// @evidence contracts/testing.md#behavioral-verification The actual banner loader imports async CJS and MJS values, rejects an invalid name/export, then fixture Node binaries supply invalid JSON and status-7 failures; errors must name failure without replaying child stderr.
// @evidence contracts/testing.md#independent-expectations Authored from cjs/from mjs literals establish actual export evaluation; fixed malformed stdout and status-7 fixture programs independently establish protocol failure inputs.
// @evidence contracts/testing.md#distinguishing-cases Actual valid CJS/MJS contrast with numeric export and wrong basename. Fake child invalid JSON, loud exit and silent exit exercise different parent decoding/error paths.
// @evidence contracts/testing.md#execution-ownership TestScriptConfigLoader calls the owning loader and real child programs: Node for valid imports, authored direct launchers for failure protocol. Fake failures do not execute the loader script.
// @evidence contracts/e2e.md#necessary-boundary Actual Node import/async export and parent stdout/exit decoding cross process boundaries. Validation semantics remain direct concerns; fake binaries establish parent protocol handling, not JS evaluator failure internals.
// @evidence contracts/e2e.md#shared-execution One fixture root contains valid config and failure launchers. Each load currently starts an independent process without a native Go producer or resident Node batch.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.Setenv restores TTSC_NODE_BINARY and t.TempDir releases fixture programs/configs. The parent waits for child exit; assertions deliberately reject stderr text being repeated in the error.
// @evidence contracts/e2e.md#preserved-coverage The body asserts the CJS and MJS texts, the invalid-name and numeric-export errors, the malformed-stdout parse error, the rejection of a payload missing its dependency observations (no observations at all, and everything but the realpaths), the failure-envelope reason carried into the error of a non-zero exit, the exit-status-7 error naming the config without repeating the child's stderr, and the silent exit-status error; stderr itself is not captured as an oracle.
func TestScriptConfigLoader(t *testing.T) {
  root := t.TempDir()
  cjs := filepath.Join(root, "banner.config.cjs")
  mjs := filepath.Join(root, "banner.config.mjs")
  shared.WriteFile(t, cjs, `module.exports = async () => ({ text: "from cjs" });`)
  shared.WriteFile(t, mjs, `export default { text: "from mjs" };`)

  raw, err := shared.BannerLoadBannerConfigFile(cjs, root)
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
  if _, err := shared.BannerLoadBannerConfigFile(filepath.Join(root, "other.cjs"), root); err == nil || !strings.Contains(err.Error(), "config file must be named") {
    t.Fatalf("expected invalid name error, got %v", err)
  }

  badExport := filepath.Join(root, "bad", "banner.config.cjs")
  shared.WriteFile(t, badExport, `module.exports = 1;`)
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

  // A value without the dependency observations is refused: accepting it would
  // claim complete observations that were never returned.
  for name, payload := range map[string]string{
    "bare-value":      `{"value":{"text":"x"}}`,
    "no-realpaths":    `{"complete":true,"inputs":[],"hashes":{},"value":{"text":"x"}}`,
  } {
    bareNode := writeDirectLauncher(t, filepath.Join(root, "fake-node-"+name), payload, "", 0)
    t.Setenv("TTSC_NODE_BINARY", bareNode)
    if _, err := bannerLoadBannerScriptConfigFile(cjs); err == nil || !strings.Contains(err.Error(), "dependency observations") {
      t.Fatalf("%s: expected missing observations error, got %v", name, err)
    }
  }

  // A failure envelope on stdout names the reason in the returned error even
  // though the process exits non-zero.
  reasonNode := writeDirectLauncher(t, filepath.Join(root, "fake-node-reason"), `{"__ttscLoaderError":"custom reason"}`, "", 1)
  t.Setenv("TTSC_NODE_BINARY", reasonNode)
  if _, err := bannerLoadBannerScriptConfigFile(cjs); err == nil || !strings.Contains(err.Error(), "load config file") || !strings.Contains(err.Error(), "custom reason") {
    t.Fatalf("expected the envelope reason in the error, got %v", err)
  }

  silentNode := writeDirectLauncher(t, filepath.Join(root, "fake-node-silent"), "", "", 7)
  t.Setenv("TTSC_NODE_BINARY", silentNode)
  if _, err := bannerLoadBannerScriptConfigFile(cjs); err == nil || !strings.Contains(err.Error(), "exit status") {
    t.Fatalf("expected silent exit error, got %v", err)
  }
}
