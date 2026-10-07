package linthost

import (
  "bytes"
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
  "testing"
)

// TestConfigCachePortableDependencyPolicies exercises cache and fingerprint
// policy directly, without evaluating a JavaScript or TypeScript config.
//
// The authored evaluator reports native helper bytes. Clearing the isolated
// memory cache exposes disk reuse; a helper edit invalidates it, and mutation
// during each evaluation forces three attempts on both consecutive loads.
// Directory, optional-file and physical-identity inputs exercise the same
// native digest/normalization operations independently of loader transport.
// Symlink directory and non-UTF-8-name branches depend on actual filesystem
// capability; merely passing this entry does not establish they ran.
//
// @evidence contracts/testing.md#behavioral-verification Direct loadCachedConfigEvaluation preserves generation1 disk reuse, returns generation2/beta after a helper edit, and retries unstable results three times on each load. Direct fingerprint operations check directory digests, optional absent-present-absent transitions, equal-byte identity retargeting, ten malformed envelopes, exact duplicate preservation and unstable soft misses. Direct root-bound cache loads preserve equivalent cleaned roots, separate different roots and restore the first root generation without any Node or ttsx child.
// @evidence contracts/testing.md#independent-expectations Literal generations/call counts and beta selection are authored; directory names are independently raw-byte sorted and NUL-encoded before SHA256, optional deletion must restore its missing digest, and physically retargeted equal bytes cannot authorize the old identity.
// @evidence contracts/testing.md#distinguishing-cases Retains empty/single/UTF-8/nested directories, capability-dependent link/raw names, optional lifecycle, native junction-or-symlink retargeting, ten separate invalid-envelope rows, valid duplicate fields and an unstable empty-digest sentinel. Actual two-loader parity and registerHooks A-B-A remain separate E2E responsibilities.
// @evidence contracts/testing.md#execution-ownership This Go entry invokes native cache/digest/normalization operations with a callback and temporary filesystem. It restores the exact prior memory-cache map and environment, removes only its two content keys and two root-bound keys, and owns inline phase/envelope failure identities. Windows identity creation uses the owning junction operation; no config-loader child or installed consumer runs.
func TestConfigCachePortableDependencyPolicies(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  root := t.TempDir()
  config := filepath.Join(root, "lint.config.cjs")
  helper := filepath.Join(root, "selection.cjs")
  configEvalCacheMu.Lock()
  previousCache := configEvalCache
  configEvalCache = map[string]cachedConfigEvaluation{}
  configEvalCacheMu.Unlock()
  t.Cleanup(func() {
    configEvalCacheMu.Lock()
    configEvalCache = previousCache
    configEvalCacheMu.Unlock()
    for _, content := range []string{
      `module.exports = require("./selection.cjs");`,
      `module.exports = require("./selection.cjs"); // unstable`,
    } {
      key := configCacheKey("config-graph", config, []byte(content))
      if err := os.Remove(filepath.Join(configCacheDir(), key+".json")); err != nil && !os.IsNotExist(err) {
        t.Errorf("remove owned cache entry: %v", err)
      }
    }
  })

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
  assertPortableDirectoryDependencyDigest(t, emptyTopology, nil)

  singleTopology := filepath.Join(root, "topology-single")
  if err := os.Mkdir(singleTopology, 0o755); err != nil {
    t.Fatal(err)
  }
  write(filepath.Join(singleTopology, "alpha"), "")
  assertPortableDirectoryDependencyDigest(
    t,
    singleTopology,
    []portableDirectoryDigestRecord{{name: []byte("alpha"), kind: "file"}},
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
  assertPortableDirectoryDependencyDigest(
    t,
    topology,
    []portableDirectoryDigestRecord{
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
    assertPortableDirectoryDependencyDigest(
      t,
      symlinkTopology,
      []portableDirectoryDigestRecord{
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
      assertPortableDirectoryDependencyDigest(
        t,
        invalidTopology,
        []portableDirectoryDigestRecord{{name: invalidName, kind: "file"}},
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

  // Root identity partitions the actual cache owner without running a loader.
  rootCalls := 0
  rootEvaluate := func(string) (evaluatedConfigFile, error) {
    rootCalls++
    body, err := os.ReadFile(config)
    if err != nil {
      return evaluatedConfigFile{}, err
    }
    sum := sha256.Sum256(body)
    return evaluatedConfigFile{
      value: map[string]any{"generation": float64(rootCalls)},
      dependenciesTracked: true,
      dependencyDigests: []configDependencyFingerprint{{
        Path: config, Digest: hex.EncodeToString(sum[:]),
        IdentityStable: true, Kind: configDependencyFile,
        Realpath: configDependencyRealpath(config), Scope: configDependencyWatch,
      }},
    }, nil
  }
  rootContent, err := os.ReadFile(config)
  if err != nil {
    t.Fatal(err)
  }
  rootA := filepath.Join(root, "root-a")
  rootB := filepath.Join(root, "root-b")
  t.Cleanup(func() {
    for _, contextRoot := range []string{rootA, rootB} {
      key := configCacheKey("config-graph\x00"+contextRoot, config, rootContent)
      if err := os.Remove(filepath.Join(configCacheDir(), key+".json")); err != nil && !os.IsNotExist(err) {
        t.Errorf("remove root-owned cache entry: %v", err)
      }
    }
  })
  for index, contextRoot := range []string{rootA, rootA + string(filepath.Separator) + ".", rootB, rootA} {
    evaluated, err := loadCachedConfigEvaluationForRoot(config, contextRoot, rootEvaluate)
    if err != nil {
      t.Fatalf("root cache epoch %d: %v", index, err)
    }
    expected := []float64{1, 1, 2, 1}[index]
    if got := configCacheGeneration(evaluated.value); got != expected {
      t.Fatalf("root cache epoch %d generation = %v, want %v", index, got, expected)
    }
  }
  if rootCalls != 2 {
    t.Fatalf("root cache evaluations = %d, want 2", rootCalls)
  }

}

type portableDirectoryDigestRecord struct {
  name   []byte
  kind   string
  target []byte
}

func assertPortableDirectoryDependencyDigest(
  t *testing.T,
  location string,
  records []portableDirectoryDigestRecord,
) {
  t.Helper()
  records = append([]portableDirectoryDigestRecord(nil), records...)
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
