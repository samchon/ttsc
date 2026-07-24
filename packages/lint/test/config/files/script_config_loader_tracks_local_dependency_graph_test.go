package linthost

import (
  "os"
  "path/filepath"
  "strconv"
  "testing"
)

// TestScriptConfigLoaderTracksLocalDependencyGraph verifies one dependency
// protocol covers CommonJS and ESM without retaining in-process module state.
//
//  1. Load a CJS config whose helper lives outside the config directory and
//     prove the entry/helper are watched while package implementation files
//     remain cache-only and package-resolution metadata is exact-watch input.
//  2. Change only the package and prove its cache fingerprint refreshes rules
//     without publishing node_modules as a project watch input.
//  3. Change only the helper and prove the dependency-aware cache evaluates
//     the same entry path again with fresh rules.
//  4. Load an MJS config with a transitive local import and prove the same graph
//     semantics apply to ESM.
//  5. Fail after a CJS child loads, repair only the child, and prove the next
//     isolated evaluation cannot reuse the stale child cache.
//  6. Load an explicitly selected config inside node_modules and prove its
//     relative helper remains local even though unrelated package imports do
//     not enter the watch graph.
//  7. Change only a package manifest's main target and prove resolution
//     metadata, not a stale entry-module cache, selects the replacement.
//  8. Add a higher-priority extension candidate and prove a directory topology
//     fingerprint invalidates an extensionless local require.
//  9. Reach one shared helper through a package before reaching it directly
//     and prove final graph reachability, not module-load order, owns its scope.
//  10. Resolve a package above the declared project root, add a nearer package
//     whose main initially selects an extension fallback, then create the exact
//     main target and prove each valid selection transition is fresh.
//  11. Resolve an absolute legacy main outside its package, using a literal
//     asterisk when the filesystem supports one, then create its exact target
//     ahead of an extension fallback and prove the transition is fresh.
//  12. Resolve a package through exports and prove ignored main and inactive
//     condition branches do not become cache or watch dependencies.
//  13. Extend an executable config from JSON and prove the nested evaluation's
//     resolution directories reach the final resolver.
func TestScriptConfigLoaderTracksLocalDependencyGraph(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  root := t.TempDir()
  configs := filepath.Join(root, "configs")
  shared := filepath.Join(root, "shared")
  packageRoot := filepath.Join(root, "node_modules", "demo")
  for _, directory := range []string{configs, shared, packageRoot} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  write := func(location string, body string) {
    t.Helper()
    if err := os.WriteFile(location, []byte(body), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(root, "package.json"), `{"type":"commonjs"}`)
  write(filepath.Join(packageRoot, "package.json"), `{"main":"index.cjs"}`)
  packageEntry := filepath.Join(packageRoot, "index.cjs")
  write(packageEntry, `module.exports = "error";`)

  cjsConfig := filepath.Join(configs, "lint.config.cjs")
  cjsHelper := filepath.Join(shared, "selection.cjs")
  write(cjsConfig, `const selection = require("../shared/selection.cjs");
module.exports = { rules: { "no-var": selection.rule } };`)
  write(cjsHelper, `module.exports = { rule: require("demo") };`)

  first, err := loadConfigFileEvaluation(cjsConfig)
  if err != nil {
    t.Fatalf("load CJS config: %v", err)
  }
  assertConfigRuleSeverity(t, first.value, "no-var", "error")
  assertConfigDependencies(
    t,
    first.dependencies,
    []string{cjsConfig, cjsHelper},
    packageRoot,
    filepath.Join(packageRoot, "package.json"),
  )
  assertConfigDependencyScope(
    t,
    first.dependencyDigests,
    packageEntry,
    configDependencyCache,
  )
  assertConfigWatchDependenciesWithin(t, first.dependencyDigests, root)

  write(packageEntry, `module.exports = "warning";`)
  second, err := loadConfigFileEvaluation(cjsConfig)
  if err != nil {
    t.Fatalf("reload CJS package: %v", err)
  }
  assertConfigRuleSeverity(t, second.value, "no-var", "warning")
  assertConfigDependencies(
    t,
    second.dependencies,
    []string{cjsConfig, cjsHelper},
    packageRoot,
    filepath.Join(packageRoot, "package.json"),
  )

  write(cjsHelper, `require("demo"); module.exports = { rule: "error" };`)
  third, err := loadConfigFileEvaluation(cjsConfig)
  if err != nil {
    t.Fatalf("reload CJS helper: %v", err)
  }
  assertConfigRuleSeverity(t, third.value, "no-var", "error")

  mjsConfig := filepath.Join(configs, "lint.config.mjs")
  mjsHelper := filepath.Join(shared, "selection.mjs")
  mjsLeaf := filepath.Join(shared, "severity.mjs")
  write(mjsLeaf, `export default "error";`)
  write(mjsHelper, `import severity from "./severity.mjs";
export default { rule: severity };`)
  write(mjsConfig, `import selection from "../shared/selection.mjs";
export default { rules: { "no-debugger": selection.rule } };`)
  esm, err := loadConfigFileEvaluation(mjsConfig)
  if err != nil {
    t.Fatalf("load MJS config: %v", err)
  }
  assertConfigRuleSeverity(t, esm.value, "no-debugger", "error")
  assertConfigDependencies(
    t,
    esm.dependencies,
    []string{mjsConfig, mjsHelper, mjsLeaf},
    packageRoot,
  )

  failingConfig := filepath.Join(configs, "failing.config.cjs")
  failingHelper := filepath.Join(shared, "failure.cjs")
  write(failingConfig, `const selection = require("../shared/failure.cjs");
if (selection.fail) throw new Error("not ready");
module.exports = { rules: { "no-var": selection.rule } };`)
  write(failingHelper, `module.exports = { fail: true, rule: "error" };`)
  if _, err := loadConfigFileEvaluation(failingConfig); err == nil {
    t.Fatal("failing config unexpectedly loaded")
  }
  write(failingHelper, `module.exports = { fail: false, rule: "warning" };`)
  recovered, err := loadConfigFileEvaluation(failingConfig)
  if err != nil {
    t.Fatalf("recovered CJS config: %v", err)
  }
  assertConfigRuleSeverity(t, recovered.value, "no-var", "warning")

  packagedConfig := filepath.Join(packageRoot, "lint.config.cjs")
  packagedHelper := filepath.Join(packageRoot, "selection.cjs")
  write(packagedConfig, `module.exports = {
  rules: { "no-var": require("./selection.cjs") },
};`)
  write(packagedHelper, `module.exports = "error";`)
  packaged, err := loadConfigFileEvaluation(packagedConfig)
  if err != nil {
    t.Fatalf("load packaged CJS config: %v", err)
  }
  assertConfigRuleSeverity(t, packaged.value, "no-var", "error")
  assertConfigDependencies(
    t,
    packaged.dependencies,
    []string{packagedConfig, packagedHelper},
    packageRoot,
    packagedConfig,
    packagedHelper,
    filepath.Join(packageRoot, "package.json"),
  )

  alternatePackageEntry := filepath.Join(packageRoot, "alternate.cjs")
  write(alternatePackageEntry, `module.exports = "error";`)
  write(packageEntry, `module.exports = "warning";`)
  manifestConfig := filepath.Join(configs, "manifest.config.cjs")
  write(manifestConfig, `module.exports = {
  rules: { "no-var": require("demo") },
};`)
  beforeManifestChange, err := loadConfigFileEvaluation(manifestConfig)
  if err != nil {
    t.Fatalf("load package manifest config: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    beforeManifestChange.value,
    "no-var",
    "warning",
  )
  write(
    filepath.Join(packageRoot, "package.json"),
    `{"main":"alternate.cjs"}`,
  )
  afterManifestChange, err := loadConfigFileEvaluation(manifestConfig)
  if err != nil {
    t.Fatalf("reload package manifest config: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    afterManifestChange.value,
    "no-var",
    "error",
  )
  assertConfigDependencyKindScope(
    t,
    afterManifestChange.dependencyDigests,
    filepath.Join(packageRoot, "package.json"),
    configDependencyFile,
    configDependencyWatch,
  )

  topologyConfig := filepath.Join(configs, "topology.config.cjs")
  topologyJSON := filepath.Join(shared, "topology.json")
  topologyJS := filepath.Join(shared, "topology.js")
  write(topologyConfig, `module.exports = {
  rules: { "no-var": require("../shared/topology") },
};`)
  write(topologyJSON, `"warning"`)
  beforeCandidateCreation, err := loadConfigFileEvaluation(topologyConfig)
  if err != nil {
    t.Fatalf("load extensionless config: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    beforeCandidateCreation.value,
    "no-var",
    "warning",
  )
  write(topologyJS, `module.exports = "error";`)
  afterCandidateCreation, err := loadConfigFileEvaluation(topologyConfig)
  if err != nil {
    t.Fatalf("reload extensionless config: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    afterCandidateCreation.value,
    "no-var",
    "error",
  )
  assertConfigDependencyKindScope(
    t,
    afterCandidateCreation.dependencyDigests,
    shared,
    configDependencyDir,
    configDependencyWatch,
  )

  diamondPackage := filepath.Join(root, "node_modules", "diamond")
  if err := os.MkdirAll(diamondPackage, 0o755); err != nil {
    t.Fatal(err)
  }
  write(
    filepath.Join(diamondPackage, "package.json"),
    `{"main":"index.cjs"}`,
  )
  diamondBridge := filepath.Join(shared, "diamond-bridge.cjs")
  diamondLeaf := filepath.Join(shared, "diamond-leaf.cjs")
  write(
    filepath.Join(diamondPackage, "index.cjs"),
    `module.exports = require("../../shared/diamond-bridge.cjs");`,
  )
  write(diamondBridge, `module.exports = require("./diamond-leaf.cjs");`)
  write(diamondLeaf, `module.exports = "warning";`)
  diamondConfig := filepath.Join(configs, "diamond.config.cjs")
  write(diamondConfig, `require("diamond");
module.exports = {
  rules: { "no-var": require("../shared/diamond-bridge.cjs") },
};`)
  diamond, err := loadConfigFileEvaluation(diamondConfig)
  if err != nil {
    t.Fatalf("load diamond dependency config: %v", err)
  }
  assertConfigRuleSeverity(t, diamond.value, "no-var", "warning")
  assertConfigDependencyKindScope(
    t,
    diamond.dependencyDigests,
    diamondBridge,
    configDependencyFile,
    configDependencyWatch,
  )
  assertConfigDependencyKindScope(
    t,
    diamond.dependencyDigests,
    diamondLeaf,
    configDependencyFile,
    configDependencyWatch,
  )

  hoistedPackage := filepath.Join(root, "node_modules", "hoisted")
  if err := os.MkdirAll(hoistedPackage, 0o755); err != nil {
    t.Fatal(err)
  }
  write(
    filepath.Join(hoistedPackage, "package.json"),
    `{"main":"index.cjs"}`,
  )
  write(filepath.Join(hoistedPackage, "index.cjs"), `module.exports = "warning";`)
  hoistedProject := filepath.Join(root, "apps", "a")
  if err := os.MkdirAll(hoistedProject, 0o755); err != nil {
    t.Fatal(err)
  }
  hoistedConfig := filepath.Join(hoistedProject, "lint.config.cjs")
  write(hoistedConfig, `module.exports = {
  rules: { "no-var": require("hoisted") },
};`)
  beforeNearerPackage, err := loadConfigFileEvaluationWithin(
    hoistedConfig,
    hoistedProject,
  )
  if err != nil {
    t.Fatalf("load outer hoisted package config: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    beforeNearerPackage.value,
    "no-var",
    "warning",
  )
  assertConfigDependencyKindScope(
    t,
    beforeNearerPackage.dependencyDigests,
    filepath.Join(hoistedProject, "package.json"),
    configDependencyOptionalFile,
    configDependencyWatch,
  )

  nearerPackage := filepath.Join(root, "apps", "node_modules", "hoisted")
  nearerTarget := filepath.Join(nearerPackage, "lib")
  if err := os.MkdirAll(nearerTarget, 0o755); err != nil {
    t.Fatal(err)
  }
  write(
    filepath.Join(nearerPackage, "package.json"),
    `{"main":"lib/index"}`,
  )
  write(filepath.Join(nearerTarget, "index.js"), `module.exports = "warning";`)
  beforeNestedMain, err := loadConfigFileEvaluationWithin(
    hoistedConfig,
    hoistedProject,
  )
  if err != nil {
    t.Fatalf("load nearer package extension fallback: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    beforeNestedMain.value,
    "no-var",
    "warning",
  )
  assertConfigDependencyKindScope(
    t,
    beforeNestedMain.dependencyDigests,
    nearerPackage,
    configDependencyDir,
    configDependencyWatch,
  )
  assertConfigDependencyKindScope(
    t,
    beforeNestedMain.dependencyDigests,
    nearerTarget,
    configDependencyDir,
    configDependencyWatch,
  )
  write(filepath.Join(nearerTarget, "index"), `module.exports = "error";`)
  afterNestedMain, err := loadConfigFileEvaluationWithin(
    hoistedConfig,
    hoistedProject,
  )
  if err != nil {
    t.Fatalf("reload nearer package config: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    afterNestedMain.value,
    "no-var",
    "error",
  )

  legacyPackage := filepath.Join(root, "node_modules", "legacy-main")
  legacyShared := filepath.Join(root, "node_modules", "legacy-main-shared")
  legacyProject := filepath.Join(root, "legacy-project")
  for _, directory := range []string{legacyPackage, legacyShared, legacyProject} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  legacyTargetName := "selection"
  asteriskProbe := filepath.Join(root, "literal*.probe")
  if err := os.WriteFile(asteriskProbe, []byte("probe"), 0o644); err == nil {
    legacyTargetName = "literal*"
    if err := os.Remove(asteriskProbe); err != nil {
      t.Fatal(err)
    }
  }
  legacyMain := filepath.ToSlash(filepath.Join(legacyShared, legacyTargetName))
  write(
    filepath.Join(legacyPackage, "package.json"),
    `{"main":`+strconv.Quote(legacyMain)+`}`,
  )
  write(
    filepath.Join(legacyShared, legacyTargetName+".js"),
    `module.exports = "warning";`,
  )
  legacyConfig := filepath.Join(legacyProject, "lint.config.cjs")
  write(legacyConfig, `module.exports = {
  rules: { "no-var": require("legacy-main") },
};`)
  beforeLegacyMain, err := loadConfigFileEvaluationWithin(
    legacyConfig,
    legacyProject,
  )
  if err != nil {
    t.Fatalf("load legacy main root fallback: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    beforeLegacyMain.value,
    "no-var",
    "warning",
  )
  assertConfigDependencyKindScope(
    t,
    beforeLegacyMain.dependencyDigests,
    legacyShared,
    configDependencyDir,
    configDependencyWatch,
  )
  write(
    filepath.Join(legacyShared, legacyTargetName),
    `module.exports = "error";`,
  )
  afterLegacyMain, err := loadConfigFileEvaluationWithin(
    legacyConfig,
    legacyProject,
  )
  if err != nil {
    t.Fatalf("reload external legacy main target: %v", err)
  }
  assertConfigRuleSeverity(
    t,
    afterLegacyMain.value,
    "no-var",
    "error",
  )

  exportsPackage := filepath.Join(root, "node_modules", "exports-priority")
  activeExports := filepath.Join(exportsPackage, "require")
  inactiveExports := filepath.Join(exportsPackage, "import")
  ignoredMain := filepath.Join(root, "ignored-exports-main")
  exportsProject := filepath.Join(root, "exports-project")
  for _, directory := range []string{
    activeExports,
    inactiveExports,
    ignoredMain,
    exportsProject,
  } {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(activeExports, "index.cjs"), `module.exports = "error";`)
  write(filepath.Join(inactiveExports, "index.cjs"), `module.exports = "warning";`)
  write(
    filepath.Join(exportsPackage, "package.json"),
    `{"main":"../../ignored-exports-main/index.cjs","exports":{".":{"import":"./import/index.cjs","require":"./require/index.cjs"}}}`,
  )
  exportsConfig := filepath.Join(exportsProject, "lint.config.cjs")
  write(exportsConfig, `module.exports = {
  rules: { "no-var": require("exports-priority") },
};`)
  exported, err := loadConfigFileEvaluationWithin(
    exportsConfig,
    exportsProject,
  )
  if err != nil {
    t.Fatalf("load conditional exports package: %v", err)
  }
  assertConfigRuleSeverity(t, exported.value, "no-var", "error")
  assertConfigDependencyKindScope(
    t,
    exported.dependencyDigests,
    activeExports,
    configDependencyDir,
    configDependencyWatch,
  )
  assertConfigDependencyAbsent(t, exported.dependencyDigests, inactiveExports)
  assertConfigDependencyAbsent(t, exported.dependencyDigests, ignoredMain)

  extendsRoot := filepath.Join(root, "extends")
  if err := os.MkdirAll(extendsRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  baseConfig := filepath.Join(extendsRoot, "base.config.cjs")
  baseSelection := filepath.Join(extendsRoot, "base-selection.js")
  childConfig := filepath.Join(extendsRoot, "lint.config.json")
  write(baseSelection, `module.exports = "warning";`)
  write(baseConfig, `module.exports = {
  rules: { "no-var": require("./base-selection") },
};`)
  write(childConfig, `{"extends":"./base.config.cjs"}`)
  resolver, err := loadConfigResolver(childConfig, extendsRoot)
  if err != nil {
    t.Fatalf("load JSON config extending executable config: %v", err)
  }
  directories := resolver.(interface{ ConfigDirectories() []string }).ConfigDirectories()
  foundExtendsRoot := false
  for _, directory := range directories {
    if filepath.Clean(directory) == filepath.Clean(extendsRoot) {
      foundExtendsRoot = true
      break
    }
  }
  if !foundExtendsRoot {
    t.Fatalf(
      "extends resolution directory %s missing from %v",
      extendsRoot,
      directories,
    )
  }
}

func assertConfigDependencyAbsent(
  t *testing.T,
  dependencies []configDependencyFingerprint,
  unexpectedPath string,
) {
  t.Helper()
  for _, dependency := range dependencies {
    if filepath.Clean(dependency.Path) == filepath.Clean(unexpectedPath) {
      t.Fatalf("unexpected dependency %s in cache graph %v", unexpectedPath, dependencies)
    }
  }
}

func assertConfigDependencyScope(
  t *testing.T,
  dependencies []configDependencyFingerprint,
  expectedPath string,
  expectedScope string,
) {
  t.Helper()
  for _, dependency := range dependencies {
    if filepath.Clean(dependency.Path) == filepath.Clean(expectedPath) {
      if dependency.Scope != expectedScope {
        t.Fatalf("dependency %s scope = %q, want %q", expectedPath, dependency.Scope, expectedScope)
      }
      return
    }
  }
  t.Fatalf("dependency %s missing from cache graph %v", expectedPath, dependencies)
}

func assertConfigDependencyKindScope(
  t *testing.T,
  dependencies []configDependencyFingerprint,
  expectedPath string,
  expectedKind string,
  expectedScope string,
) {
  t.Helper()
  for _, dependency := range dependencies {
    if filepath.Clean(dependency.Path) != filepath.Clean(expectedPath) {
      continue
    }
    if dependency.Kind != expectedKind || dependency.Scope != expectedScope {
      t.Fatalf(
        "dependency %s = kind %q scope %q, want kind %q scope %q",
        expectedPath,
        dependency.Kind,
        dependency.Scope,
        expectedKind,
        expectedScope,
      )
    }
    return
  }
  t.Fatalf("dependency %s missing from cache graph %v", expectedPath, dependencies)
}

func assertConfigWatchDependenciesWithin(
  t *testing.T,
  dependencies []configDependencyFingerprint,
  root string,
) {
  t.Helper()
  for _, dependency := range dependencies {
    if dependency.Scope != configDependencyWatch {
      continue
    }
    relative, err := filepath.Rel(root, dependency.Path)
    if err != nil ||
      filepath.IsAbs(relative) ||
      startsWithParentDirectory(relative) {
      t.Fatalf(
        "watch dependency escaped project boundary %s: %#v",
        root,
        dependency,
      )
    }
  }
}

func assertConfigDependencies(
  t *testing.T,
  actual []string,
  expected []string,
  excludedRoot string,
  allowedWithinExcludedRoot ...string,
) {
  t.Helper()
  allowed := make(map[string]struct{}, len(allowedWithinExcludedRoot))
  for _, location := range allowedWithinExcludedRoot {
    allowed[filepath.Clean(location)] = struct{}{}
  }
  found := map[string]struct{}{}
  for _, location := range actual {
    location = filepath.Clean(location)
    found[location] = struct{}{}
    relative, err := filepath.Rel(excludedRoot, location)
    if err == nil &&
      relative != ".." &&
      !filepath.IsAbs(relative) &&
      !startsWithParentDirectory(relative) {
      if _, ok := allowed[location]; !ok {
        t.Fatalf("package dependency leaked into local graph: %s", location)
      }
    }
  }
  for _, location := range expected {
    if _, ok := found[filepath.Clean(location)]; !ok {
      t.Fatalf("dependency %s missing from %v", location, actual)
    }
  }
}

func startsWithParentDirectory(relative string) bool {
  return relative == ".." ||
    len(relative) > 3 && relative[:3] == ".."+string(filepath.Separator)
}

func assertConfigRuleSeverity(
  t *testing.T,
  value any,
  rule string,
  expected string,
) {
  t.Helper()
  config, ok := value.(map[string]any)
  if !ok {
    t.Fatalf("config has type %T", value)
  }
  rules, ok := config["rules"].(map[string]any)
  if !ok {
    t.Fatalf("rules have type %T", config["rules"])
  }
  if actual := rules[rule]; actual != expected {
    t.Fatalf("%s = %v, want %s", rule, actual, expected)
  }
}
