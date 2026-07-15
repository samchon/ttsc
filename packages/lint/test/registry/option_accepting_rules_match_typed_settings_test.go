package linthost

import (
  "os"
  "path/filepath"
  "regexp"
  "runtime"
  "sort"
  "strings"
  "testing"
)

// TestOptionAcceptingRulesMatchTypedSettings verifies the runtime options
// capability, each public TypeScript rule setting, and the single-object
// options map describe the same built-in contract.
//
// The engine cannot infer option use from `Context.DecodeOptions`: helpers and
// shared dispatchers hide calls from simple source scans, while some public
// upstream-compatible schemas intentionally reserve options that the current
// native check does not inspect. The structural `AcceptsTtscLintOptions`
// capability is therefore the runtime source of truth. Exact parity with the
// typed setting surface prevents both silent runtime-only options and typed
// tuples that the engine would reject. Positional settings stay outside
// `ITtscLintRuleOptionsMap`; every `TtscLintRuleOptionsSetting<T>` key must be
// present in that map and no map-only key may exist.
//
//  1. Read every concrete family rule setting and options-map entry.
//  2. Compare built-in, non-format rules accepting options with every typed
//     setting richer than `TtscLintRuleSetting`.
//  3. Compare generic single-object settings with the options map exactly.
func TestOptionAcceptingRulesMatchTypedSettings(t *testing.T) {
  settings, err := readTypedRuleSettings()
  if err != nil {
    t.Fatalf("read typed rule settings: %v", err)
  }
  mapped, err := readTypedRuleOptionsMapKeys()
  if err != nil {
    t.Fatalf("read typed rule options map: %v", err)
  }

  runtimeOptions := map[string]struct{}{}
  for _, name := range AllRuleNames() {
    rule := LookupRule(name)
    if !isRegisteredBuiltInNonFormatRule(name, rule) {
      continue
    }
    if ruleAcceptsOptions(rule) {
      runtimeOptions[name] = struct{}{}
    }
  }

  typedOptions := map[string]struct{}{}
  genericOptions := map[string]struct{}{}
  for name, setting := range settings {
    if setting == "TtscLintRuleSetting" {
      continue
    }
    typedOptions[name] = struct{}{}
    if strings.HasPrefix(setting, "TtscLintRuleOptionsSetting<") {
      genericOptions[name] = struct{}{}
    }
  }

  assertSameRuleNameSet(t, "runtime AcceptsTtscLintOptions", runtimeOptions, "typed option settings", typedOptions)
  assertSameRuleNameSet(t, "TtscLintRuleOptionsSetting keys", genericOptions, "ITtscLintRuleOptionsMap", mapped)
}

func readTypedRuleOptionsMapKeys() (map[string]struct{}, error) {
  _, thisFile, _, ok := runtime.Caller(0)
  if !ok {
    return nil, errMissingCaller{}
  }
  path := filepath.Join(
    filepath.Dir(thisFile), "..", "src", "structures", "rules",
    "ITtscLintRuleOptionsMap.ts",
  )
  body, err := os.ReadFile(path)
  if err != nil {
    return nil, err
  }
  keys := map[string]struct{}{}
  property := regexp.MustCompile(`^\s*"([\w][\w/-]*)"\s*:`)
  for _, line := range strings.Split(string(body), "\n") {
    if match := property.FindStringSubmatch(line); match != nil {
      keys[match[1]] = struct{}{}
    }
  }
  return keys, nil
}

func assertSameRuleNameSet(
  t *testing.T,
  leftLabel string,
  left map[string]struct{},
  rightLabel string,
  right map[string]struct{},
) {
  t.Helper()
  var onlyLeft, onlyRight []string
  for name := range left {
    if _, ok := right[name]; !ok {
      onlyLeft = append(onlyLeft, name)
    }
  }
  for name := range right {
    if _, ok := left[name]; !ok {
      onlyRight = append(onlyRight, name)
    }
  }
  sort.Strings(onlyLeft)
  sort.Strings(onlyRight)
  if len(onlyLeft) > 0 || len(onlyRight) > 0 {
    t.Fatalf(
      "%s and %s differ: only %s=%v; only %s=%v",
      leftLabel,
      rightLabel,
      leftLabel,
      onlyLeft,
      rightLabel,
      onlyRight,
    )
  }
}
