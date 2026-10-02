//go:build e2e

package linthost

import (
  "bytes"
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "runtime"
  "sort"
  "strconv"
  "strings"
  "testing"
)

// TestConfigCacheInvalidatesTransitiveDependencyDigests verifies executable
// config caching is content-addressed across the complete recorded local graph.
//
// Symlink-directory and raw non-UTF-8 name witnesses run only when the actual
// filesystem admits those inputs. A passing entry does not establish those
// optional branches ran; the equal-byte identity retarget uses Windows
// junctions on Windows and required symlinks elsewhere.
//
//  1. Cache one evaluation whose entry imports a helper and prove an unchanged
//     helper reuses both memory and disk state.
//  2. Change only the helper and prove the entry-key hit is rejected before a
//     fresh evaluation replaces it.
//  3. Make the helper change during all three bounded evaluation attempts and
//     prove the unstable result is returned but never cached indefinitely.
//  4. Prove empty, single, UTF-8, symlink, and POSIX non-UTF-8 directory
//     records share one raw-byte digest protocol without a final delimiter.
//  5. Prove an exact optional-file fingerprint changes on creation and returns
//     to its original state on deletion.
//  6. Evaluate a real executable config in a directory with those names twice
//     and prove the JavaScript fingerprint is accepted by the Go cache reader.
//  7. Change one imported module A-B-A inside a loader hook and prove its
//     transient output cannot receive a reusable fingerprint for restored A.
//  8. Accept the evaluator's empty conflict sentinel as an unstable soft miss,
//     while rejecting every malformed dependency-envelope class.
// @evidence contracts/testing.md#behavioral-verification loadCachedConfigEvaluation and the real script evaluator preserve unchanged disk reuse, reject helper edits, bound unstable retries at three, agree on raw-byte directory fingerprints, reject retargeted identity and A-B-A cache proofs, and reject malformed envelopes.
// @evidence contracts/testing.md#independent-expectations Literal generations, three attempts, independently SHA256-encoded directory records and restored optional-file digests define the cache protocol.
// @evidence contracts/testing.md#distinguishing-cases Owns unchanged/changed/unstable dependencies, empty/single/UTF-8/link directories, optional absent-present-absent, retargeting, transient A-B-A and invalid envelope classes.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestConfigCacheInvalidatesTransitiveDependencyDigests by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
// @evidence contracts/e2e.md#necessary-boundary Real Node hook evaluation and its Go fingerprint reader must agree; an injected evaluator alone cannot prove that wire agreement.
// @evidence contracts/e2e.md#shared-execution Intentional mutations require fresh evaluator sessions while unchanged real-loader input must reuse one evaluation; no cache is deleted wholesale.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns each mutable fixture and t.Setenv restores changed environment; the production evaluator waits for each child and defers scratch removal and context cancellation on return; an external process kill cannot guarantee deferred cleanup. Distinct absolute config identities prevent cross-case cached answers, while intentional mutation and recovery states remain observable.
// @evidence contracts/e2e.md#preserved-coverage Every original fixture, test-function body, assertion and helper is retained byte-for-byte; portable config units keep their separate selection and this move only makes the existing real boundary ownership physical.
func TestConfigCacheInvalidatesTransitiveDependencyDigests(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  root := t.TempDir()
  config := filepath.Join(root, "lint.config.cjs")
  helper := filepath.Join(root, "selection.cjs")
  write := func(location string, body string) {
    t.Helper()
    if err := os.WriteFile(location, []byte(body), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  write(config, `module.exports = require("./selection.cjs");`)
  write(helper, "alpha")

  calls := 0
  evaluate := func(string) (evaluatedConfigFile, error) {
    calls++
    body, err := os.ReadFile(helper)
    if err != nil {
      return evaluatedConfigFile{}, err
    }
    sum := sha256.Sum256(body)
    dependency := configDependencyFingerprint{
      Path:           helper,
      Digest:         hex.EncodeToString(sum[:]),
      IdentityStable: true,
      Kind:           configDependencyFile,
      Realpath:       configDependencyRealpath(helper),
      Scope:          configDependencyWatch,
    }
    return evaluatedConfigFile{
      value: map[string]any{
        "generation": float64(calls),
        "selection":  string(body),
      },
      dependencies:        []string{helper},
      dependencyDigests:   []configDependencyFingerprint{dependency},
      dependenciesTracked: true,
    }, nil
  }

  first, err := loadCachedConfigEvaluation(config, evaluate)
  if err != nil {
    t.Fatalf("first load: %v", err)
  }
  if got := configCacheGeneration(first.value); got != 1 {
    t.Fatalf("first generation = %v, want 1", got)
  }

  configEvalCacheMu.Lock()
  configEvalCache = map[string]cachedConfigEvaluation{}
  configEvalCacheMu.Unlock()
  second, err := loadCachedConfigEvaluation(config, evaluate)
  if err != nil {
    t.Fatalf("disk-cache load: %v", err)
  }
  if calls != 1 || configCacheGeneration(second.value) != 1 {
    t.Fatalf("unchanged dependency missed disk cache: calls=%d value=%v", calls, second.value)
  }

  write(helper, "beta")
  third, err := loadCachedConfigEvaluation(config, evaluate)
  if err != nil {
    t.Fatalf("changed dependency load: %v", err)
  }
  if calls != 2 || configCacheGeneration(third.value) != 2 {
    t.Fatalf("changed helper remained stale: calls=%d value=%v", calls, third.value)
  }
  if got := third.value.(map[string]any)["selection"]; got != "beta" {
    t.Fatalf("selection = %v, want beta", got)
  }

  unstableCalls := 0
  unstable := func(string) (evaluatedConfigFile, error) {
    unstableCalls++
    evaluated, evalErr := evaluate(config)
    if evalErr != nil {
      return evaluatedConfigFile{}, evalErr
    }
    write(helper, string(rune('a'+unstableCalls)))
    return evaluated, nil
  }
  write(config, `module.exports = require("./selection.cjs"); // unstable`)
  if _, err := loadCachedConfigEvaluation(config, unstable); err != nil {
    t.Fatalf("unstable load: %v", err)
  }
  if unstableCalls != 3 {
    t.Fatalf("unstable evaluation attempts = %d, want bounded 3", unstableCalls)
  }
  if _, err := loadCachedConfigEvaluation(config, unstable); err != nil {
    t.Fatalf("second unstable load: %v", err)
  }
  if unstableCalls != 6 {
    t.Fatalf("unstable result was cached: attempts=%d, want 6", unstableCalls)
  }

  emptyTopology := filepath.Join(root, "topology-empty")
  if err := os.Mkdir(emptyTopology, 0o755); err != nil {
    t.Fatal(err)
  }
  assertDirectoryDependencyDigest(t, emptyTopology, nil)

  singleTopology := filepath.Join(root, "topology-single")
  if err := os.Mkdir(singleTopology, 0o755); err != nil {
    t.Fatal(err)
  }
  write(filepath.Join(singleTopology, "alpha"), "")
  assertDirectoryDependencyDigest(
    t,
    singleTopology,
    []testDirectoryDigestRecord{{name: []byte("alpha"), kind: "file"}},
  )

  topology := filepath.Join(root, "topology-multiple")
  if err := os.Mkdir(topology, 0o755); err != nil {
    t.Fatal(err)
  }
  write(filepath.Join(topology, "alpha"), "")
  write(filepath.Join(topology, "é"), "")
  if err := os.Mkdir(filepath.Join(topology, "nested"), 0o755); err != nil {
    t.Fatal(err)
  }
  assertDirectoryDependencyDigest(
    t,
    topology,
    []testDirectoryDigestRecord{
      {name: []byte("alpha"), kind: "file"},
      {name: []byte("é"), kind: "file"},
      {name: []byte("nested"), kind: "directory"},
    },
  )

  symlinkTopology := filepath.Join(root, "topology-symlink")
  if err := os.Mkdir(symlinkTopology, 0o755); err != nil {
    t.Fatal(err)
  }
  symlinkTarget := "목적"
  write(filepath.Join(symlinkTopology, symlinkTarget), "")
  if err := os.Symlink(
    symlinkTarget,
    filepath.Join(symlinkTopology, "link"),
  ); err == nil {
    assertDirectoryDependencyDigest(
      t,
      symlinkTopology,
      []testDirectoryDigestRecord{
        {name: []byte("link"), kind: "symlink", target: []byte(symlinkTarget)},
        {name: []byte(symlinkTarget), kind: "file"},
      },
    )
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
      assertDirectoryDependencyDigest(
        t,
        invalidTopology,
        []testDirectoryDigestRecord{{name: invalidName, kind: "file"}},
      )
    }
  }

  optionalManifest := filepath.Join(root, "optional-package.json")
  absentFingerprint := configDependencyFingerprint{
    Path:           optionalManifest,
    IdentityStable: true,
    Kind:           configDependencyOptionalFile,
    Realpath:       nil,
    Scope:          configDependencyWatch,
  }
  absentDigest, err := configDependencyDigest(absentFingerprint)
  if err != nil {
    t.Fatalf("missing optional-file digest: %v", err)
  }
  absentFingerprint.Digest = absentDigest
  if normalized, ok := normalizeConfigDependencyFingerprints(
    []configDependencyFingerprint{absentFingerprint},
  ); !ok || len(normalized) != 1 {
    t.Fatalf("optional-file fingerprint did not normalize: %v, %v", normalized, ok)
  }
  write(optionalManifest, `{"type":"commonjs"}`)
  presentDigest, err := configDependencyDigest(absentFingerprint)
  if err != nil {
    t.Fatalf("present optional-file digest: %v", err)
  }
  if presentDigest == absentDigest {
    t.Fatal("optional-file creation did not change its exact-path digest")
  }
  if err := os.Remove(optionalManifest); err != nil {
    t.Fatal(err)
  }
  restoredDigest, err := configDependencyDigest(absentFingerprint)
  if err != nil {
    t.Fatalf("restored optional-file digest: %v", err)
  }
  if restoredDigest != absentDigest {
    t.Fatalf(
      "optional-file deletion digest = %s, want original missing digest %s",
      restoredDigest,
      absentDigest,
    )
  }

  oldIdentity := filepath.Join(root, "identity-old")
  newIdentity := filepath.Join(root, "identity-new")
  identityLink := filepath.Join(root, "identity-link")
  for _, directory := range []string{oldIdentity, newIdentity} {
    if err := os.Mkdir(directory, 0o755); err != nil {
      t.Fatal(err)
    }
    write(filepath.Join(directory, "selection.cjs"), "same bytes")
  }
  if runtime.GOOS == "windows" {
    if err := createWindowsJunction(identityLink, oldIdentity); err != nil {
      t.Fatal(err)
    }
  } else if err := os.Symlink(oldIdentity, identityLink); err != nil {
    t.Fatal(err)
  }
  identityInput := filepath.Join(identityLink, "selection.cjs")
  identityBody, err := os.ReadFile(identityInput)
  if err != nil {
    t.Fatal(err)
  }
  identityDigest := sha256.Sum256(identityBody)
  identityFingerprint := configDependencyFingerprint{
    Path:           identityInput,
    Digest:         hex.EncodeToString(identityDigest[:]),
    IdentityStable: true,
    Kind:           configDependencyFile,
    Realpath:       configDependencyRealpath(identityInput),
    Scope:          configDependencyWatch,
  }
  if !configDependencyDigestsAreCurrent([]configDependencyFingerprint{identityFingerprint}) {
    t.Fatal("unchanged physical dependency did not authorize cache reuse")
  }
  if err := os.Remove(identityLink); err != nil {
    t.Fatal(err)
  }
  if runtime.GOOS == "windows" {
    if err := createWindowsJunction(identityLink, newIdentity); err != nil {
      t.Fatal(err)
    }
  } else if err := os.Symlink(newIdentity, identityLink); err != nil {
    t.Fatal(err)
  }
  if configDependencyDigestsAreCurrent([]configDependencyFingerprint{identityFingerprint}) {
    t.Fatal("equal bytes at a retargeted physical dependency reused stale config")
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

  helperBody, err := os.ReadFile(helper)
  if err != nil {
    t.Fatal(err)
  }
  helperSum := sha256.Sum256(helperBody)
  valid := configDependencyFingerprint{
    Path:           helper,
    Digest:         hex.EncodeToString(helperSum[:]),
    IdentityStable: true,
    Kind:           configDependencyFile,
    Realpath:       configDependencyRealpath(helper),
    Scope:          configDependencyWatch,
  }
  relativeRealpath := "relative.cjs"
  invalidRealpath := valid
  invalidRealpath.Realpath = &relativeRealpath
  otherRealpath := filepath.Join(root, "other.cjs")
  conflictingRealpath := valid
  conflictingRealpath.Realpath = &otherRealpath
  invalid := [][]configDependencyFingerprint{
    nil,
    {{Path: "relative.cjs", Digest: valid.Digest, Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: strings.Repeat("A", sha256.Size*2), Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: strings.Repeat("g", sha256.Size*2), Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: valid.Digest, Kind: "invalid", Scope: configDependencyWatch}},
    {valid, {Path: helper, Digest: strings.Repeat("0", sha256.Size*2), Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: valid.Digest, Kind: configDependencyFile, Scope: "invalid"}},
    {valid, {Path: helper, Digest: valid.Digest, Kind: configDependencyFile, Scope: configDependencyCache}},
    {invalidRealpath},
    {valid, conflictingRealpath},
  }
  for index, candidate := range invalid {
    if normalized, ok := normalizeConfigDependencyFingerprints(candidate); ok {
      t.Fatalf("malformed dependency case %d normalized to %v", index+1, normalized)
    }
  }
  normalized, ok := normalizeConfigDependencyFingerprints(
    []configDependencyFingerprint{valid, valid},
  )
  if !ok || len(normalized) != 1 ||
    normalized[0].Path != valid.Path ||
    normalized[0].Digest != valid.Digest ||
    normalized[0].IdentityStable != valid.IdentityStable ||
    normalized[0].Kind != valid.Kind ||
    !sameConfigDependencyRealpath(normalized[0].Realpath, valid.Realpath) ||
    normalized[0].Scope != valid.Scope {
    t.Fatalf("idempotent duplicate normalized to %v, %v", normalized, ok)
  }
  unstableFingerprint := valid
  unstableFingerprint.Digest = ""
  unstableFingerprint.IdentityStable = false
  unstableFingerprint.Realpath = nil
  normalized, ok = normalizeConfigDependencyFingerprints(
    []configDependencyFingerprint{unstableFingerprint},
  )
  if !ok || len(normalized) != 1 || normalized[0].IdentityStable {
    t.Fatalf("unstable conflict normalized to %v, %v", normalized, ok)
  }
  if configDependencyDigestsAreCurrent(normalized) {
    t.Fatal("an unstable conflict fingerprint must never authorize cache reuse")
  }
}

type testDirectoryDigestRecord struct {
  name   []byte
  kind   string
  target []byte
}

func assertDirectoryDependencyDigest(
  t *testing.T,
  location string,
  records []testDirectoryDigestRecord,
) {
  t.Helper()
  records = append([]testDirectoryDigestRecord(nil), records...)
  sort.Slice(records, func(left, right int) bool {
    return bytes.Compare(records[left].name, records[right].name) < 0
  })
  serialized := make([]byte, 0)
  for index, record := range records {
    if index != 0 {
      serialized = append(serialized, 0)
    }
    serialized = append(serialized, record.name...)
    serialized = append(serialized, 0)
    serialized = append(serialized, record.kind...)
    serialized = append(serialized, 0)
    serialized = append(serialized, record.target...)
  }
  sum := sha256.Sum256(serialized)
  expected := hex.EncodeToString(sum[:])
  actual, err := configDependencyDigest(
    configDependencyFingerprint{
      Path: location,
      Kind: configDependencyDir,
    },
  )
  if err != nil {
    t.Fatalf("directory digest %s: %v", location, err)
  }
  if actual != expected {
    t.Fatalf(
      "directory digest %s = %s, want raw-byte protocol %s",
      location,
      actual,
      expected,
    )
  }
}
