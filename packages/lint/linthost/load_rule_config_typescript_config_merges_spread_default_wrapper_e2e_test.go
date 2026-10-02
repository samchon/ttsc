//go:build e2e

package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigTypeScriptConfigMergesSpreadDefaultWrapper verifies shared config composition.
//
// A namespace import of another TypeScript config produces the same plain
// `{ default: config }` shape users hit when CJS/ESM interop wraps a shared
// config. Spreading that wrapper beside local keys must preserve both sides:
// inherited rules and local ignores.
//
// 1. Write a shared `.ts` config with one rule.
// 2. Write a package `.ts` config that spreads the module wrapper and adds an ignore.
// 3. Assert the rule applies to normal files but not to the ignored path.
//
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver preserves the namespace-spread inherited no-debugger error for main.ts and turns it off for the local ignored functional path.
// @evidence contracts/testing.md#independent-expectations The shared literal error rule and local functional glob independently require error versus off.
// @evidence contracts/testing.md#distinguishing-cases Owns synchronous namespace wrapper composition and admitted versus ignored file paths; async returned wrappers have a separate boundary.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestLoadRuleConfigTypeScriptConfigMergesSpreadDefaultWrapper by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
// @evidence contracts/e2e.md#necessary-boundary Actual typed namespace import shape and serializer normalization connect shared module output to Go file filtering.
// @evidence contracts/e2e.md#shared-execution One evaluator loads both modules in one request; private fixture origin prevents an unrelated case supplying the inherited rule.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns each mutable fixture; the production evaluator waits for each child and defers scratch removal and context cancellation on return; an external process kill cannot guarantee deferred cleanup. Distinct absolute config identities prevent cross-case cached answers, while intentional mutation and recovery states remain observable.
// @evidence contracts/e2e.md#preserved-coverage This fixture and its assertions run only under the e2e build tag, through the shared Go boundary entry; the portable config units keep their separate untagged selection.
func TestLoadRuleConfigTypeScriptConfigMergesSpreadDefaultWrapper(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "shared-lint.config.ts"), `export default {
  rules: {
    "no-debugger": "error",
  },
};`)
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.ts"), `import * as shared from "./shared-lint.config.ts";

export default {
  ...shared,
  ignores: ["src/functional/**/*.ts"],
};`)

  resolver, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.ts",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }

  main := resolver.ResolveRules(filepath.Join(dir, "src", "main.ts"))
  if main.Rules.Severity("no-debugger") != SeverityError {
    t.Fatalf("main no-debugger: want error from shared config, got %v", main.Rules.Severity("no-debugger"))
  }
  ignored := resolver.ResolveRules(filepath.Join(dir, "src", "functional", "api.ts"))
  if ignored.Rules.Severity("no-debugger") != SeverityOff {
    t.Fatalf("ignored no-debugger: want off from local ignores, got %v", ignored.Rules.Severity("no-debugger"))
  }
}
