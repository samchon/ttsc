package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestScriptConfigLoaderTracksLocalDependencyGraph verifies one dependency
// protocol covers CommonJS and ESM without retaining in-process module state.
//
//  1. Load a CJS config whose helper lives outside the config directory and
//     prove the entry and helper, but not a package dependency, are recorded.
//  2. Change only that helper and prove the dependency-aware cache evaluates
//     the same entry path again with fresh rules.
//  3. Load an MJS config with a transitive local import and prove the same graph
//     semantics apply to ESM.
//  4. Fail after a CJS child loads, repair only the child, and prove the next
//     isolated evaluation cannot reuse the stale child cache.
//  5. Load an explicitly selected config inside node_modules and prove its
//     relative helper remains local even though unrelated package imports do
//     not enter the dependency graph.
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
  write(filepath.Join(packageRoot, "package.json"), `{"main":"index.cjs"}`)
  write(filepath.Join(packageRoot, "index.cjs"), `module.exports = "package";`)

  cjsConfig := filepath.Join(configs, "lint.config.cjs")
  cjsHelper := filepath.Join(shared, "selection.cjs")
  write(cjsConfig, `const selection = require("../shared/selection.cjs");
module.exports = { rules: { "no-var": selection.rule } };`)
  write(cjsHelper, `require("demo"); module.exports = { rule: "error" };`)

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
  )

  write(cjsHelper, `require("demo"); module.exports = { rule: "warning" };`)
  second, err := loadConfigFileEvaluation(cjsConfig)
  if err != nil {
    t.Fatalf("reload CJS helper: %v", err)
  }
  assertConfigRuleSeverity(t, second.value, "no-var", "warning")

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
    filepath.Join(packageRoot, "unrelated-package"),
  )
}

func assertConfigDependencies(
  t *testing.T,
  actual []string,
  expected []string,
  excludedRoot string,
) {
  t.Helper()
  found := map[string]struct{}{}
  for _, location := range actual {
    location = filepath.Clean(location)
    found[location] = struct{}{}
    relative, err := filepath.Rel(excludedRoot, location)
    if err == nil &&
      relative != ".." &&
      !filepath.IsAbs(relative) &&
      !startsWithParentDirectory(relative) {
      t.Fatalf("package dependency leaked into local graph: %s", location)
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
