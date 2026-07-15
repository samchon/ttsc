package linthost

import (
  "os"
  "path/filepath"
  "regexp"
  "runtime"
  "strings"
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsHasTypedOptionsKey pins the typed surface for
// `unicorn/no-unnecessary-polyfills` against its Go runtime.
//
// The Go rule accepts and honors a `targets` option (validated in
// `unicornNoUnnecessaryPolyfillsDecodeOptions`, consumed in Check), but the
// published TypeScript key was severity-only (`TtscLintRuleSetting`), so a
// type-checked `lint.config.ts` passing `{ targets: "node 18" }` was a TS error
// even though the runtime needs it (samchon/ttsc#626). This test locks the
// three-part wiring — the rules key, the options map, and the options interface —
// so the typed surface can never silently regress back to severity-only.
//
// A general options-parity sweep (every ValidateOptions/DecodeOptions rule owns
// an options-typed key) is intentionally NOT asserted here: several unrelated
// rules still carry severity-only keys on master and are being corrected in
// separate parity PRs, so a broad assertion would fail on rules outside this
// change. This test is scoped to the rule this change fixes.
//
//  1. Read the three structures/rules TS sources next to this scratch test.
//  2. Assert the rules key references TtscLintRuleOptionsSetting with the
//     dedicated options interface, the options map carries the entry, and the
//     options interface declares a `targets` property.
func TestUnicornNoUnnecessaryPolyfillsHasTypedOptionsKey(t *testing.T) {
  rulesDir := structuresRulesDir(t)

  unicornRules := readStructuresRuleFile(t, rulesDir, "ITtscLintUnicornRules.ts")
  keyPattern := regexp.MustCompile(
    `"unicorn/no-unnecessary-polyfills"\?\s*:\s*TtscLintRuleOptionsSetting<\s*ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions\s*>`,
  )
  if !keyPattern.MatchString(unicornRules) {
    t.Fatalf(
      "unicorn/no-unnecessary-polyfills must be typed as " +
        "TtscLintRuleOptionsSetting<ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions> " +
        "so a config passing { targets } type-checks; the runtime honors that option")
  }

  optionsMap := readStructuresRuleFile(t, rulesDir, "ITtscLintRuleOptionsMap.ts")
  if !strings.Contains(
    optionsMap,
    `"unicorn/no-unnecessary-polyfills": ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions;`,
  ) {
    t.Fatal("ITtscLintRuleOptionsMap is missing the unicorn/no-unnecessary-polyfills entry")
  }

  optionsIface := readStructuresRuleFile(t, rulesDir, "ITtscLintUnicornRuleOptions.ts")
  ifacePattern := regexp.MustCompile(
    `interface ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions\s*\{[^}]*\btargets\b`,
  )
  if !ifacePattern.MatchString(optionsIface) {
    t.Fatal("ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions must declare a `targets` property")
  }
}

// structuresRulesDir resolves packages/lint/src/structures/rules relative to the
// running test file. scripts/test-go-lint.cjs flattens the Go tests into
// linthost/ alongside the verbatim src/ tree, so the rules directory sits one
// level up — the same layout the name-parity test relies on.
func structuresRulesDir(t *testing.T) string {
  t.Helper()
  _, thisFile, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("runtime.Caller(0) returned ok=false; cannot locate structures/rules/")
  }
  return filepath.Join(filepath.Dir(thisFile), "..", "src", "structures", "rules")
}

func readStructuresRuleFile(t *testing.T, rulesDir, name string) string {
  t.Helper()
  body, err := os.ReadFile(filepath.Join(rulesDir, name))
  if err != nil {
    t.Fatalf("read %s: %v", name, err)
  }
  return string(body)
}
