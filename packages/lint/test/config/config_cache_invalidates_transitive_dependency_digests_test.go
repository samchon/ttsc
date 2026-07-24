package linthost

import (
  "bytes"
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "sort"
  "strconv"
  "strings"
  "testing"
)

// TestConfigCacheInvalidatesTransitiveDependencyDigests verifies executable
// config caching is content-addressed across the complete recorded local graph.
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
//  7. Reject every malformed dependency-envelope class while accepting an
//     idempotent duplicate, so corrupt cache state can only become a soft miss.
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
      Path:   helper,
      Digest: hex.EncodeToString(sum[:]),
      Kind:   configDependencyFile,
      Scope:  configDependencyWatch,
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
    invalidName = invalidCandidate
    assertDirectoryDependencyDigest(
      t,
      invalidTopology,
      []testDirectoryDigestRecord{{name: invalidName, kind: "file"}},
    )
  }

  optionalManifest := filepath.Join(root, "optional-package.json")
  absentFingerprint := configDependencyFingerprint{
    Path:  optionalManifest,
    Kind:  configDependencyOptionalFile,
    Scope: configDependencyWatch,
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

  helperBody, err := os.ReadFile(helper)
  if err != nil {
    t.Fatal(err)
  }
  helperSum := sha256.Sum256(helperBody)
  valid := configDependencyFingerprint{
    Path:   helper,
    Digest: hex.EncodeToString(helperSum[:]),
    Kind:   configDependencyFile,
    Scope:  configDependencyWatch,
  }
  invalid := [][]configDependencyFingerprint{
    nil,
    {{Path: "relative.cjs", Digest: valid.Digest, Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: "", Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: strings.Repeat("A", sha256.Size*2), Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: strings.Repeat("g", sha256.Size*2), Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: valid.Digest, Kind: "invalid", Scope: configDependencyWatch}},
    {valid, {Path: helper, Digest: strings.Repeat("0", sha256.Size*2), Kind: configDependencyFile, Scope: configDependencyWatch}},
    {{Path: helper, Digest: valid.Digest, Kind: configDependencyFile, Scope: "invalid"}},
    {valid, {Path: helper, Digest: valid.Digest, Kind: configDependencyFile, Scope: configDependencyCache}},
  }
  for index, candidate := range invalid {
    if normalized, ok := normalizeConfigDependencyFingerprints(candidate); ok {
      t.Fatalf("malformed dependency case %d normalized to %v", index+1, normalized)
    }
  }
  normalized, ok := normalizeConfigDependencyFingerprints(
    []configDependencyFingerprint{valid, valid},
  )
  if !ok || len(normalized) != 1 || normalized[0] != valid {
    t.Fatalf("idempotent duplicate normalized to %v, %v", normalized, ok)
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
