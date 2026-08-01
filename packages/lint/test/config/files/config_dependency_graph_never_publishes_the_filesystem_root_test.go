package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestConfigDependencyGraphNeverPublishesTheFilesystemRoot verifies a resolution
// trace records the ancestor it actually observed instead of fingerprinting the
// directory that contains it.
//
// The collector walks path components from the filesystem root and holds
// `current` at that root through the whole first iteration, so every early
// return there published `/` as a watch input and digested it by enumerating
// the entire root. Four branches reach that state -- an ancestor that fails
// `lstat`, a symlink ancestor, an ancestor that is not a directory, and a
// candidate whose last component sits directly on the root -- so proving only
// the reported macOS `/var` case would leave the rest publishing the record.
//
// The parent digest is not the defect and must survive. It is how a sibling
// that would win extension resolution invalidates the cache, so only the root
// case narrows to the observed ancestor; every ordinary parent is unchanged.
//
//  1. Resolve a manifest main whose first component does not exist, and require
//     the root absent while that exact ancestor is recorded as an `entry`.
//  2. Resolve a candidate that lands directly on the root and require the same.
//  3. Resolve an ordinary in-project candidate and require its parent directory
//     digest to survive, so the narrowing did not remove real invalidation.
func TestConfigDependencyGraphNeverPublishesTheFilesystemRoot(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  t.Setenv("TTSC_LINT_DEBUG_CONFIG_GRAPH", "1")
  root := t.TempDir()
  write := func(location string, body string) {
    t.Helper()
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(location, []byte(body), 0o644); err != nil {
      t.Fatal(err)
    }
  }

  // The filesystem root of the temporary tree, whatever spelling this host
  // uses. On Windows that is the drive root, not "/".
  filesystemRoot := filepath.VolumeName(root) + string(filepath.Separator)

  write(filepath.Join(root, "package.json"), `{"type":"commonjs"}`)

  // 1. An absolute main whose very first component is absent. The collector
  //    fails `lstat` on that component while `current` is still the root.
  absentAncestor := filepath.Join(filesystemRoot, "ttsc-lint-absent-ancestor")
  absentMain := filepath.Join(absentAncestor, "main.cjs")
  absentPackage := filepath.Join(root, "node_modules", "absent-main")
  write(
    filepath.Join(absentPackage, "package.json"),
    `{"main":`+quoteJSONPath(absentMain)+`}`,
  )
  write(filepath.Join(absentPackage, "index.js"), `module.exports = "error";`)

  absentConfig := filepath.Join(root, "lint.config.cjs")
  write(absentConfig, `module.exports = { rules: { "no-var": require("absent-main") } };`)

  absent, err := loadConfigFileEvaluation(absentConfig)
  if err != nil {
    t.Fatalf("load config resolving an absent absolute main: %v", err)
  }
  assertConfigRuleSeverity(t, absent.value, "no-var", "error")
  assertConfigDependencyAbsent(t, absent.dependencyDigests, filesystemRoot)
  assertConfigDependencyKindScope(
    t,
    absent.dependencyDigests,
    absentAncestor,
    configDependencyEntry,
    configDependencyWatch,
  )

  // 2. A candidate whose resolved path sits directly on the root. The walk
  //    reaches its last component while `current` is still the root, so the
  //    parent-digest reasoning would enumerate the root one more way.
  rootLevelMain := filepath.Join(filesystemRoot, "ttsc-lint-absent-root-main.js")
  rootLevelPackage := filepath.Join(root, "node_modules", "root-level-main")
  write(
    filepath.Join(rootLevelPackage, "package.json"),
    `{"main":`+quoteJSONPath(rootLevelMain)+`}`,
  )
  write(filepath.Join(rootLevelPackage, "index.js"), `module.exports = "warning";`)

  rootLevelConfig := filepath.Join(root, "lint.rootlevel.cjs")
  write(rootLevelConfig, `module.exports = { rules: { "no-var": require("root-level-main") } };`)

  rootLevel, err := loadConfigFileEvaluation(rootLevelConfig)
  if err != nil {
    t.Fatalf("load config resolving a root-level main: %v", err)
  }
  assertConfigRuleSeverity(t, rootLevel.value, "no-var", "warning")
  assertConfigDependencyAbsent(t, rootLevel.dependencyDigests, filesystemRoot)

  // 3. The parent digest itself is untouched away from the root. An ordinary
  //    in-project ancestor still fingerprints the directory that owns the
  //    competing candidates, so narrowing the root cannot have narrowed the
  //    invalidation the collector actually relies on.
  ownedParent := filepath.Join(root, "owned")
  ownedCandidate := filepath.Join(ownedParent, "target.js")
  write(ownedCandidate, `module.exports = "warning";`)
  ownedPackage := filepath.Join(root, "node_modules", "owned-parent")
  write(
    filepath.Join(ownedPackage, "package.json"),
    `{"main":`+quoteJSONPath(ownedCandidate)+`}`,
  )
  ownedConfig := filepath.Join(root, "lint.owned.cjs")
  write(ownedConfig, `module.exports = { rules: { "no-var": require("owned-parent") } };`)

  owned, err := loadConfigFileEvaluation(ownedConfig)
  if err != nil {
    t.Fatalf("load config resolving an in-project candidate: %v", err)
  }
  assertConfigRuleSeverity(t, owned.value, "no-var", "warning")
  assertConfigDependencyAbsent(t, owned.dependencyDigests, filesystemRoot)
  assertConfigDependencyKindScope(
    t,
    owned.dependencyDigests,
    ownedParent,
    configDependencyDir,
    configDependencyWatch,
  )
  assertConfigWatchDependenciesWithin(t, owned.dependencyDigests, root)
}

// quoteJSONPath renders an absolute host path as a JSON string literal. Windows
// separators are not legal JSON escapes, so they cannot ride into a manifest
// unescaped.
func quoteJSONPath(location string) string {
  encoded := make([]rune, 0, len(location)+2)
  encoded = append(encoded, '"')
  for _, character := range location {
    if character == '\\' || character == '"' {
      encoded = append(encoded, '\\')
    }
    encoded = append(encoded, character)
  }
  return string(append(encoded, '"'))
}
