//go:build e2e

package linthost

import (
	"bytes"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

// TestConfigCacheInvalidatesTransitiveDependencyDigests retains actual script
// loader parity and A-B-A consumed-input proof, rather than repeating native
// cache policy already owned by TestConfigCachePortableDependencyPolicies.
//
// Two lookups of the same executable CJS config must execute its authored
// counter once. Its UTF-8 and filesystem-admitted raw non-UTF-8 names connect
// the JavaScript directory fingerprint to Go's cache admission. A separate
// registerHooks evaluation loads transient B and restores A, but must return
// the transient rule without granting reusable dependency proof.
//
// @evidence contracts/testing.md#behavioral-verification Actual loadConfigFileEvaluation calls must share one authored counter evaluation under the recorded directory protocol. loadScriptConfigEvaluationWithin executes the real A-B-A hook, and Go admission must reject its unstable fingerprint. Direct cache retry, optional-file, retargeting and envelope decisions execute in the maintained untagged TestConfigCachePortableDependencyPolicies instead.
// @evidence contracts/testing.md#independent-expectations Literal counter 1, during/rule off, restored original module bytes, IdentityStable false and an empty digest distinguish actual loader reuse and transient observation from a fabricated stable cache answer.
// @evidence contracts/testing.md#distinguishing-cases Same-config unchanged lookups retain UTF-8 names and raw non-UTF-8 names only when the filesystem preserves those bytes. The hook's A-B-A result must remain non-reusable despite restored bytes; the complementary native-only empty/link/optional/identity/envelope cases remain with the ordinary owning unit.
// @evidence contracts/testing.md#execution-ownership nativeLintConnections still selects this tagged Go body by exact name through the same GoBoundary batch. Two real cache API lookups and one direct A-B-A loader call remain; removing duplicated policy assertions does not remove this donor or certify independent E2E execution totals. The test isolates and restores the original memory-cache map and environment, while temporary roots retain separate loader/counter and mutation ownership.
func TestConfigCacheInvalidatesTransitiveDependencyDigests(t *testing.T) {
	t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
	configEvalCacheMu.Lock()
	previousCache := configEvalCache
	configEvalCache = map[string]cachedConfigEvaluation{}
	configEvalCacheMu.Unlock()
	t.Cleanup(func() {
		configEvalCacheMu.Lock()
		configEvalCache = previousCache
		configEvalCacheMu.Unlock()
	})
	root := t.TempDir()
	write := func(location string, body string) {
		t.Helper()
		if err := os.WriteFile(location, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	invalidName := []byte(nil)
	invalidTopology := filepath.Join(root, "topology-invalid")
	if err := os.Mkdir(invalidTopology, 0o755); err != nil {
		t.Fatal(err)
	}
	invalidCandidate := []byte{0xff, 'x'}
	if err := os.WriteFile(
		filepath.Join(invalidTopology, string(invalidCandidate)),
		nil,
		0o644,
	); err == nil {
		entries, readErr := os.ReadDir(invalidTopology)
		if readErr != nil {
			t.Fatal(readErr)
		}
		if len(entries) == 1 && bytes.Equal([]byte(entries[0].Name()), invalidCandidate) {
			invalidName = invalidCandidate
		}
	}

	loaderRoot := filepath.Join(root, "loader-parity")
	loaderConfigRoot := filepath.Join(loaderRoot, "config")
	loaderCounterRoot := filepath.Join(loaderRoot, "counter")
	for _, directory := range []string{loaderConfigRoot, loaderCounterRoot} {
		if err := os.MkdirAll(directory, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	write(filepath.Join(loaderConfigRoot, "package.json"), `{"type":"commonjs"}`)
	write(filepath.Join(loaderConfigRoot, "é"), "")
	if invalidName != nil {
		write(filepath.Join(loaderConfigRoot, string(invalidName)), "")
	}
	loaderCounter := filepath.Join(loaderCounterRoot, "calls")
	loaderConfig := filepath.Join(loaderConfigRoot, "lint.config.cjs")
	write(loaderConfig, `const fs = require("node:fs");
const counter = `+strconv.Quote(loaderCounter)+`;
let calls = 0;
try { calls = Number(fs.readFileSync(counter, "utf8")); } catch {}
fs.writeFileSync(counter, String(calls + 1));
module.exports = { rules: {} };`)
	if _, err := loadConfigFileEvaluation(loaderConfig); err != nil {
		t.Fatalf("first real-loader evaluation: %v", err)
	}
	if _, err := loadConfigFileEvaluation(loaderConfig); err != nil {
		t.Fatalf("cached real-loader evaluation: %v", err)
	}
	loaderCalls, err := os.ReadFile(loaderCounter)
	if err != nil {
		t.Fatal(err)
	}
	if string(loaderCalls) != "1" {
		t.Fatalf(
			"JavaScript and Go directory fingerprints disagreed: evaluations=%s, want 1",
			loaderCalls,
		)
	}

	abaRoot := filepath.Join(root, "loader-aba")
	if err := os.MkdirAll(abaRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	abaDependency := filepath.Join(abaRoot, "selection.cjs")
	abaConfig := filepath.Join(abaRoot, "lint.config.cjs")
	beforeModule := `module.exports = { rules: { "before/rule": "off" } };` + "\n"
	duringModule := `module.exports = { rules: { "during/rule": "off" } };` + "\n"
	write(abaDependency, beforeModule)
	write(abaConfig, `const fs = require("node:fs");
const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");
const dependency = `+strconv.Quote(abaDependency)+`;
const dependencyURL = pathToFileURL(fs.realpathSync(dependency)).href;
const before = `+strconv.Quote(beforeModule)+`;
const during = `+strconv.Quote(duringModule)+`;
registerHooks({
  load(url, context, nextLoad) {
    if (url !== dependencyURL) return nextLoad(url, context);
    fs.writeFileSync(dependency, during, "utf8");
    try { return nextLoad(url, context); }
    finally { fs.writeFileSync(dependency, before, "utf8"); }
  },
});
module.exports = () => require(dependency);`)
	abaEvaluation, err := loadScriptConfigEvaluationWithin(abaConfig, abaRoot)
	if err != nil {
		t.Fatalf("A-B-A loader evaluation: %v", err)
	}
	rules, ok := abaEvaluation.value.(map[string]any)["rules"].(map[string]any)
	if !ok || rules["during/rule"] != "off" {
		t.Fatalf("A-B-A loader did not return transient module output: %#v", abaEvaluation.value)
	}
	if body, readErr := os.ReadFile(abaDependency); readErr != nil || string(body) != beforeModule {
		t.Fatalf("A-B-A dependency was not restored: body=%q err=%v", body, readErr)
	}
	var abaFingerprint *configDependencyFingerprint
	for index := range abaEvaluation.dependencyDigests {
		dependency := &abaEvaluation.dependencyDigests[index]
		if dependency.Kind == configDependencyFile && sameConfigTestPath(dependency.Path, abaDependency) {
			abaFingerprint = dependency
			break
		}
	}
	if abaFingerprint == nil {
		t.Fatalf("A-B-A dependency was not reported: %#v", abaEvaluation.dependencyDigests)
	}
	if abaFingerprint.IdentityStable || abaFingerprint.Digest != "" {
		t.Fatalf("A-B-A dependency retained reusable proof: %#v", *abaFingerprint)
	}
	if configDependencyDigestsAreCurrent([]configDependencyFingerprint{*abaFingerprint}) {
		t.Fatal("A-B-A dependency fingerprint authorized stale cache reuse")
	}

}
