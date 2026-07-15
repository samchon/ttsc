package linthost

import (
  "os"
  "path/filepath"
  "regexp"
  "runtime"
  "strings"
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsHasTypedOptionsKey pins the typed payload
// surface for `unicorn/no-unnecessary-polyfills` against its Go runtime.
//
// The Go rule accepts and honors a `targets` option (validated in
// `unicornNoUnnecessaryPolyfillsDecodeOptions`, consumed in Check), but the
// published TypeScript key was once severity-only, so a type-checked config
// passing `{ targets: "node 18" }` failed even though the runtime needed it
// (samchon/ttsc#626). The general options-parity test now locks the rule key,
// marker, and options-map connection, but it cannot inspect semantic fields
// inside each options interface. This focused assertion keeps the `targets`
// payload itself from silently disappearing.
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
    `(?s)export interface ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions\s*\{(.*?)\n\}`,
  )
  iface := ifacePattern.FindStringSubmatch(optionsIface)
  propertyPattern := regexp.MustCompile(
    `(?m)^\s*targets\s*:\s*TtscLintUnicornNoUnnecessaryPolyfillsTargets\s*;\s*$`,
  )
  if iface == nil || !propertyPattern.MatchString(iface[1]) {
    t.Fatal("ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions must declare a `targets` property")
  }
}

// structuresRulesDir resolves packages/lint/src/structures/rules relative to
// the running test file. scripts/test-go-lint.cjs flattens the Go tests into
// linthost/ alongside the verbatim src/ tree, so the rules directory sits one
// level up, matching the layout used by the general parity tests.
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
