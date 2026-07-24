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
//  14. Retarget the selected exports path through a nested symlink and prove
//     only that lexical path invalidates while the package root stays absent.
//  15. Load the conditional package from a TypeScript config and prove the
//     generated typed loader applies the same active-condition semantics.
//  16. Resolve a dangling external legacy-main link through root fallback, then
//     create its unchanged target and prove the new main becomes visible.
//  17. Resolve an outer package past an existing but unresolvable nearer
//     candidate, then create only the nearer index file and prove the search
//     result is recomputed rather than served from the recorded topology.
//  18. Select an exports target carrying a query string and prove the lexical
//     symlink chain Node actually resolves stays fingerprinted across a
//     retarget.
//  19. Resolve one package through an inactive condition, an encoded target, a
//     wildcard pattern whose first array entry is invalid, and a null-blocked
//     subpath, and prove only the active targets enter the graph.
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
  assertConfigDependencyKindAbsent(
    t,
    beforeNestedMain.dependencyDigests,
    nearerPackage,
    configDependencyDir,
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
  assertConfigWatchDependenciesWithin(
    t,
    beforeLegacyMain.dependencyDigests,
    root,
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
  exportsBridge := filepath.Join(exportsPackage, "bridge")
  ignoredMain := filepath.Join(root, "ignored-exports-main")
  exportsProject := filepath.Join(root, "exports-project")
  for _, directory := range []string{
    activeExports,
    inactiveExports,
    exportsBridge,
    ignoredMain,
    exportsProject,
  } {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(activeExports, "index.cjs"), `module.exports = "error";`)
  write(filepath.Join(inactiveExports, "index.cjs"), `module.exports = "warning";`)
  exportsTarget := "./require/index.cjs"
  exportsLink := filepath.Join(exportsBridge, "active")
  exportsLinkSupported := false
  if err := os.Symlink(filepath.Join("..", "require"), exportsLink); err == nil {
    exportsTarget = "./bridge/active/index.cjs"
    exportsLinkSupported = true
  }
  write(
    filepath.Join(exportsPackage, "package.json"),
    `{"main":"../../ignored-exports-main/index.cjs","exports":{".":{"import":"./import/index.cjs","require":`+
      strconv.Quote(exportsTarget)+`}}}`,
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
  assertConfigDependencyKindAbsent(
    t,
    exported.dependencyDigests,
    exportsPackage,
    configDependencyDir,
  )
  if exportsLinkSupported {
    assertConfigDependencyKindScope(
      t,
      exported.dependencyDigests,
      exportsBridge,
      configDependencyDir,
      configDependencyWatch,
    )
    if err := os.Remove(exportsLink); err != nil {
      t.Fatal(err)
    }
    if err := os.Symlink(filepath.Join("..", "import"), exportsLink); err != nil {
      t.Fatal(err)
    }
    retargeted, err := loadConfigFileEvaluationWithin(
      exportsConfig,
      exportsProject,
    )
    if err != nil {
      t.Fatalf("reload retargeted exports symlink: %v", err)
    }
    assertConfigRuleSeverity(t, retargeted.value, "no-var", "warning")
  }

  typedExportsConfig := filepath.Join(configs, "exports.config.ts")
  write(typedExportsConfig, `import severity from "exports-priority";
export default { rules: { "no-var": severity } };`)
  typedExports, err := loadConfigFileEvaluation(typedExportsConfig)
  if err != nil {
    t.Fatalf("load typed conditional exports config: %v", err)
  }
  assertConfigRuleSeverity(t, typedExports.value, "no-var", "warning")
  assertConfigDependencyKindScope(
    t,
    typedExports.dependencyDigests,
    inactiveExports,
    configDependencyDir,
    configDependencyWatch,
  )

  danglingPackage := filepath.Join(root, "node_modules", "dangling-main")
  danglingContainer := filepath.Join(root, "dangling-targets")
  danglingTarget := filepath.Join(danglingContainer, "selection")
  danglingLink := filepath.Join(danglingPackage, "link")
  for _, directory := range []string{danglingPackage, danglingContainer} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  danglingSupported := false
  if err := os.Symlink(danglingTarget, danglingLink); err == nil {
    danglingSupported = true
  }
  if danglingSupported {
    write(
      filepath.Join(danglingPackage, "package.json"),
      `{"main":"link/index.cjs"}`,
    )
    write(filepath.Join(danglingPackage, "index.js"), `module.exports = "warning";`)
    danglingConfig := filepath.Join(configs, "dangling.config.cjs")
    write(danglingConfig, `module.exports = {
  rules: { "no-var": require("dangling-main") },
};`)
    beforeDanglingTarget, err := loadConfigFileEvaluation(danglingConfig)
    if err != nil {
      t.Fatalf("load dangling legacy main fallback: %v", err)
    }
    assertConfigRuleSeverity(
      t,
      beforeDanglingTarget.value,
      "no-var",
      "warning",
    )
    assertConfigDependencyKindScope(
      t,
      beforeDanglingTarget.dependencyDigests,
      danglingContainer,
      configDependencyDir,
      configDependencyWatch,
    )
    if err := os.MkdirAll(danglingTarget, 0o755); err != nil {
      t.Fatal(err)
    }
    write(filepath.Join(danglingTarget, "index.cjs"), `module.exports = "error";`)
    afterDanglingTarget, err := loadConfigFileEvaluation(danglingConfig)
    if err != nil {
      t.Fatalf("reload appeared dangling legacy main target: %v", err)
    }
    assertConfigRuleSeverity(
      t,
      afterDanglingTarget.value,
      "no-var",
      "error",
    )
  }

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

  shadowProject := filepath.Join(root, "shadow-project")
  shadowNearer := filepath.Join(shadowProject, "node_modules", "shadowed")
  shadowOuter := filepath.Join(root, "node_modules", "shadowed")
  for _, directory := range []string{shadowNearer, shadowOuter} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(shadowOuter, "package.json"), `{"main":"index.cjs"}`)
  write(filepath.Join(shadowOuter, "index.cjs"), `module.exports = "error";`)
  shadowConfig := filepath.Join(shadowProject, "lint.config.cjs")
  write(shadowConfig, `module.exports = {
  rules: { "no-var": require("shadowed") },
};`)
  beforeShadow, err := loadConfigFileEvaluationWithin(shadowConfig, shadowProject)
  if err != nil {
    t.Fatalf("load outer package past an unresolvable nearer candidate: %v", err)
  }
  assertConfigRuleSeverity(t, beforeShadow.value, "no-var", "error")
  assertConfigDependencyKindScope(
    t,
    beforeShadow.dependencyDigests,
    filepath.Join(shadowNearer, "index.js"),
    configDependencyOptionalFile,
    configDependencyWatch,
  )
  assertConfigDependencyKindAbsent(
    t,
    beforeShadow.dependencyDigests,
    shadowOuter,
    configDependencyDir,
  )
  write(filepath.Join(shadowNearer, "index.js"), `module.exports = "warning";`)
  afterShadow, err := loadConfigFileEvaluationWithin(shadowConfig, shadowProject)
  if err != nil {
    t.Fatalf("reload nearer package that became resolvable: %v", err)
  }
  assertConfigRuleSeverity(t, afterShadow.value, "no-var", "warning")

  queryPackage := filepath.Join(root, "node_modules", "query-exports")
  queryActive := filepath.Join(queryPackage, "active")
  queryFallback := filepath.Join(queryPackage, "fallback")
  queryBridge := filepath.Join(queryPackage, "bridge")
  queryProject := filepath.Join(root, "query-project")
  for _, directory := range []string{
    queryActive,
    queryFallback,
    queryBridge,
    queryProject,
  } {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(queryActive, "index.cjs"), `module.exports = "error";`)
  write(filepath.Join(queryFallback, "index.cjs"), `module.exports = "warning";`)
  queryLink := filepath.Join(queryBridge, "selected")
  if err := os.Symlink(filepath.Join("..", "active"), queryLink); err == nil {
    write(
      filepath.Join(queryPackage, "package.json"),
      `{"exports":{".":"./bridge/selected/index.cjs?v=1"}}`,
    )
    queryConfig := filepath.Join(queryProject, "lint.config.cjs")
    write(queryConfig, `module.exports = {
  rules: { "no-var": require("query-exports") },
};`)
    beforeQueryRetarget, err := loadConfigFileEvaluationWithin(
      queryConfig,
      queryProject,
    )
    if err != nil {
      t.Fatalf("load query-suffixed exports target: %v", err)
    }
    assertConfigRuleSeverity(t, beforeQueryRetarget.value, "no-var", "error")
    assertConfigDependencyKindScope(
      t,
      beforeQueryRetarget.dependencyDigests,
      queryBridge,
      configDependencyDir,
      configDependencyWatch,
    )
    if err := os.Remove(queryLink); err != nil {
      t.Fatal(err)
    }
    if err := os.Symlink(filepath.Join("..", "fallback"), queryLink); err != nil {
      t.Fatal(err)
    }
    afterQueryRetarget, err := loadConfigFileEvaluationWithin(
      queryConfig,
      queryProject,
    )
    if err != nil {
      t.Fatalf("reload retargeted query-suffixed exports target: %v", err)
    }
    assertConfigRuleSeverity(t, afterQueryRetarget.value, "no-var", "warning")
  }

  branchPackage := filepath.Join(root, "node_modules", "exports-branches")
  branchEntry := filepath.Join(branchPackage, "entry")
  branchReal := filepath.Join(branchPackage, "real")
  branchProject := filepath.Join(root, "branch-project")
  for _, directory := range []string{branchEntry, branchReal, branchProject} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(branchEntry, "main entry.cjs"), `module.exports = "error";`)
  write(filepath.Join(branchReal, "pick.cjs"), `module.exports = "warning";`)
  write(
    filepath.Join(branchPackage, "package.json"),
    `{"exports":{`+
      `".":{"ttsc-unknown":"./absent.cjs","require":"./entry/main%20entry.cjs"},`+
      `"./alias/*":["../escaped.cjs","./real/*.cjs"],`+
      `"./blocked":null}}`,
  )
  branchConfig := filepath.Join(branchProject, "lint.config.cjs")
  write(branchConfig, `let blocked = "off";
try {
  require("exports-branches/blocked");
} catch {
  blocked = "error";
}
module.exports = {
  rules: {
    "no-var": require("exports-branches"),
    "no-debugger": require("exports-branches/alias/pick"),
    "no-eval": blocked,
  },
};`)
  branches, err := loadConfigFileEvaluationWithin(branchConfig, branchProject)
  if err != nil {
    t.Fatalf("load exports branch matrix: %v", err)
  }
  assertConfigRuleSeverity(t, branches.value, "no-var", "error")
  assertConfigRuleSeverity(t, branches.value, "no-debugger", "warning")
  assertConfigRuleSeverity(t, branches.value, "no-eval", "error")
  assertConfigDependencyKindScope(
    t,
    branches.dependencyDigests,
    branchEntry,
    configDependencyDir,
    configDependencyWatch,
  )
  assertConfigDependencyKindScope(
    t,
    branches.dependencyDigests,
    branchReal,
    configDependencyDir,
    configDependencyWatch,
  )
  assertConfigDependencyAbsent(
    t,
    branches.dependencyDigests,
    filepath.Join(branchPackage, "absent.cjs"),
  )
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

func assertConfigDependencyKindAbsent(
  t *testing.T,
  dependencies []configDependencyFingerprint,
  unexpectedPath string,
  unexpectedKind string,
) {
  t.Helper()
  for _, dependency := range dependencies {
    if filepath.Clean(dependency.Path) == filepath.Clean(unexpectedPath) &&
      dependency.Kind == unexpectedKind {
      t.Fatalf(
        "unexpected %s dependency %s in cache graph %v",
        unexpectedKind,
        unexpectedPath,
        dependencies,
      )
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
