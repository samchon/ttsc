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
// the entire root. Three branches reach that first iteration -- a symlink
// ancestor, an ancestor that does not exist, and an ancestor that is not a
// directory -- so proving only the reported macOS `/var` case would leave the
// other two publishing the same record. Suppressing the root outright is not
// the fix either: the collector visits a symlink ancestor deliberately, and the
// link topology it learns there still has to invalidate the cache.
//
//  1. Resolve a package whose manifest main is an absolute path whose first
//     component does not exist, and require the root to be absent while that
//     exact ancestor is recorded as an `entry`.
//  2. Resolve a package through a symlink ancestor and a non-directory ancestor
//     inside the project, and require the same treatment for both.
//  3. Retarget the symlink ancestor and require the evaluation to refresh, so
//     the narrower record still observes link topology.
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
  write(filepath.Join(absentPackage, "index.cjs"), `module.exports = "error";`)

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

  // 2. A symlink ancestor and a non-directory ancestor, both inside the project
  //    so the fixture controls them. These are the other two first-iteration
  //    branches, reached at a depth the test can actually create.
  target := filepath.Join(root, "real-packages")
  linked := filepath.Join(root, "linked-packages")
  write(filepath.Join(target, "via-link", "package.json"), `{"main":"index.cjs"}`)
  write(filepath.Join(target, "via-link", "index.cjs"), `module.exports = "warning";`)
  if err := os.Symlink(target, linked); err != nil {
    t.Skipf("host cannot create directory symlink: %v", err)
  }

  notADirectory := filepath.Join(root, "plain-file")
  write(notADirectory, "not a directory\n")
  throughFile := filepath.Join(notADirectory, "nested", "main.cjs")

  linkedPackage := filepath.Join(root, "node_modules", "through-link")
  write(
    filepath.Join(linkedPackage, "package.json"),
    `{"main":`+quoteJSONPath(filepath.Join(linked, "via-link", "index.cjs"))+`}`,
  )
  write(filepath.Join(linkedPackage, "index.cjs"), `module.exports = "off";`)

  filePackage := filepath.Join(root, "node_modules", "through-file")
  write(
    filepath.Join(filePackage, "package.json"),
    `{"main":`+quoteJSONPath(throughFile)+`}`,
  )
  write(filepath.Join(filePackage, "index.cjs"), `module.exports = "error";`)

  ancestorConfig := filepath.Join(root, "lint.ancestors.cjs")
  write(ancestorConfig, `module.exports = { rules: {
  "no-var": require("through-link"),
  "eqeqeq": require("through-file"),
} };`)

  ancestors, err := loadConfigFileEvaluation(ancestorConfig)
  if err != nil {
    t.Fatalf("load config resolving symlink and non-directory ancestors: %v", err)
  }
  assertConfigRuleSeverity(t, ancestors.value, "no-var", "warning")
  assertConfigRuleSeverity(t, ancestors.value, "eqeqeq", "error")
  assertConfigDependencyAbsent(t, ancestors.dependencyDigests, filesystemRoot)
  assertConfigDependencyKindScope(
    t,
    ancestors.dependencyDigests,
    linked,
    configDependencyEntry,
    configDependencyWatch,
  )
  assertConfigDependencyKindScope(
    t,
    ancestors.dependencyDigests,
    notADirectory,
    configDependencyEntry,
    configDependencyWatch,
  )
  // The narrower record replaces the parent digest; it must not also keep
  // publishing the containing directory it was introduced to avoid.
  assertConfigDependencyKindAbsent(
    t,
    ancestors.dependencyDigests,
    root,
    configDependencyDir,
  )

  // 3. Retarget the symlink. The recorded entry digest is the link target, so a
  //    repoint has to produce a different selection rather than a cache hit.
  retarget := filepath.Join(root, "other-packages")
  write(filepath.Join(retarget, "via-link", "package.json"), `{"main":"index.cjs"}`)
  write(filepath.Join(retarget, "via-link", "index.cjs"), `module.exports = "error";`)
  if err := os.Remove(linked); err != nil {
    t.Fatal(err)
  }
  if err := os.Symlink(retarget, linked); err != nil {
    t.Fatal(err)
  }

  retargeted, err := loadConfigFileEvaluation(ancestorConfig)
  if err != nil {
    t.Fatalf("reload config after retargeting the symlink ancestor: %v", err)
  }
  assertConfigRuleSeverity(t, retargeted.value, "no-var", "error")
  assertConfigDependencyAbsent(t, retargeted.dependencyDigests, filesystemRoot)
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
