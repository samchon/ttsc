package linthost

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
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
//  4. Prove Go validates the exact directory byte stream emitted by every
//     JavaScript loader, including its lack of a final record delimiter.
//  5. Reject every malformed dependency-envelope class while accepting an
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

  topology := filepath.Join(root, "topology")
  if err := os.Mkdir(topology, 0o755); err != nil {
    t.Fatal(err)
  }
  write(filepath.Join(topology, "alpha"), "")
  if err := os.Mkdir(filepath.Join(topology, "nested"), 0o755); err != nil {
    t.Fatal(err)
  }
  serializedDirectory := strings.Join(
    []string{
      "alpha\x00file\x00",
      "nested\x00directory\x00",
    },
    "\x00",
  )
  serializedSum := sha256.Sum256([]byte(serializedDirectory))
  directoryDigest, err := configDependencyDigest(
    configDependencyFingerprint{
      Path: topology,
      Kind: configDependencyDir,
    },
  )
  if err != nil {
    t.Fatalf("directory digest: %v", err)
  }
  if want := hex.EncodeToString(serializedSum[:]); directoryDigest != want {
    t.Fatalf(
      "directory digest = %s, want JavaScript byte protocol %s",
      directoryDigest,
      want,
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
