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

// TestTypedKeysMatchRegisteredRules pins the contract between
// `packages/lint/src/structures/rules/ITtscLint*Rules.ts` (the typed
// surface exposed to plugin authors) and `AllRuleNames()` (the Go
// runtime). Both sides must agree exactly on which rule ids exist.
//
// The surface contains hundreds of rules and keeps growing. A new rule added in
// Go without a typed counterpart would only surface as a silent autocomplete
// miss; a new typed key without a Go registration would silently no-op at
// runtime. This test makes both sides honest at build time.
//
// The runtime side is classified without namespace assumptions. FormatRule
// implementations are absent because formatter behavior belongs to the
// top-level ITtscLintFormat block. Contributor adapters and arbitrary direct
// test registrations are absent because only native built-ins own entries in
// the append-only built-in rule-code ledger.
//
//  1. Walk every `ITtscLint*Rules.ts` file under
//     `packages/lint/src/structures/rules/`.
//  2. Extract every property key matching `"<id>"?` — either quoted
//     kebab-case form. Bare-identifier keys are also accepted because
//     three Core keys historically used the bare form.
//  3. Compare the typed-key set against structurally classified built-in,
//     non-format registrations, reporting drift on each side separately.
func TestTypedKeysMatchRegisteredRules(t *testing.T) {
  typed, err := readTypedRuleKeys()
  if err != nil {
    t.Fatalf("read typed rule keys: %v", err)
  }
  registered := registeredRuleSetForParity()

  var missingFromTyped, missingFromRegistered []string
  for name := range registered {
    if _, ok := typed[name]; !ok {
      missingFromTyped = append(missingFromTyped, name)
    }
  }
  for name := range typed {
    if _, ok := registered[name]; !ok {
      missingFromRegistered = append(missingFromRegistered, name)
    }
  }
  sort.Strings(missingFromTyped)
  sort.Strings(missingFromRegistered)

  if len(missingFromTyped) != 0 {
    t.Errorf("registered Go rules with no matching typed key (add to a family interface under structures/rules/): %v", missingFromTyped)
  }
  if len(missingFromRegistered) != 0 {
    t.Errorf("typed keys with no registered Go rule (add or remove the typed key): %v", missingFromRegistered)
  }
}

// registeredRuleSetForParity returns the canonical built-in, non-format rule
// set used by typed-surface parity. Runtime contributors and test-only direct
// registrations have no built-in TypeScript family property, while format
// rules are configured through ITtscLintFormat instead of ITtscLintRules.
func registeredRuleSetForParity() map[string]struct{} {
  out := make(map[string]struct{}, len(AllRuleNames()))
  for _, name := range AllRuleNames() {
    if !isRegisteredBuiltInNonFormatRule(name, LookupRule(name)) {
      continue
    }
    out[name] = struct{}{}
  }
  return out
}

// isRegisteredBuiltInNonFormatRule classifies registry entries by runtime
// provenance rather than namespace spelling. The append-only built-in rule-code
// ledger excludes arbitrary direct registrations, and the structural adapter
// check also excludes a contributor that reuses a retired ledger name.
func isRegisteredBuiltInNonFormatRule(name string, candidate Rule) bool {
  return isRegisteredBuiltInRule(name, candidate) && !isFormatRule(candidate)
}

// isRegisteredBuiltInFormatRule is the format-side twin used to compare the
// live format-block expansion with every native formatter registration.
func isRegisteredBuiltInFormatRule(name string, candidate Rule) bool {
  return isRegisteredBuiltInRule(name, candidate) && isFormatRule(candidate)
}

func isRegisteredBuiltInRule(name string, candidate Rule) bool {
  if candidate == nil {
    return false
  }
  switch candidate.(type) {
  case contributorAdapter, formatContributorAdapter:
    return false
  }
  _, builtIn := builtInRuleCodes[name]
  return builtIn
}

// readTypedRuleKeys scans `packages/lint/src/structures/rules/`
// relative to this test file and pulls out every property key in
// every family interface.
func readTypedRuleKeys() (map[string]struct{}, error) {
  settings, err := readTypedRuleSettings()
  if err != nil {
    return nil, err
  }
  keys := make(map[string]struct{}, len(settings))
  for name := range settings {
    keys[name] = struct{}{}
  }
  return keys, nil
}

// readTypedRuleSettings returns the declared property type for every concrete
// built-in rule key. The options-contract parity test shares this source walk
// so name parity and setting-shape parity cannot drift onto different parsers.
func readTypedRuleSettings() (map[string]string, error) {
  _, thisFile, _, ok := runtime.Caller(0)
  if !ok {
    return nil, errMissingCaller{}
  }
  // The scratch layout used by scripts/test-go-lint.cjs flattens the
  // package into a temp dir: linthost/ sits alongside src/structures/
  // (Go tests get copied into linthost/, the TS source tree is copied
  // verbatim at the same level). So the rules directory lives one
  // directory up from the running test file.
  rulesDir := filepath.Join(
    filepath.Dir(thisFile), "..", "src", "structures", "rules",
  )
  entries, err := os.ReadDir(rulesDir)
  if err != nil {
    return nil, err
  }
  settings := make(map[string]string)
  quoted := regexp.MustCompile(`^\s*"([\w][\w/-]*)"\?\s*:\s*([^;]+);`)
  bare := regexp.MustCompile(`^\s*([a-zA-Z_$][\w]*)\?\s*:\s*([^;]+);`)
  for _, entry := range entries {
    name := entry.Name()
    if entry.IsDir() || !strings.HasSuffix(name, ".ts") {
      continue
    }
    if !strings.HasPrefix(name, "ITtscLint") || !strings.HasSuffix(name, "Rules.ts") {
      continue
    }
    if name == "ITtscLintRules.ts" || name == "ITtscLintContributorRules.ts" {
      // ITtscLintRules is the intersection alias; ITtscLintContributorRules
      // is the open-ended index signature — neither carries concrete
      // rule keys.
      continue
    }
    body, err := os.ReadFile(filepath.Join(rulesDir, name))
    if err != nil {
      return nil, err
    }
    for _, line := range strings.Split(string(body), "\n") {
      if m := quoted.FindStringSubmatch(line); m != nil {
        settings[m[1]] = strings.TrimSpace(m[2])
        continue
      }
      if m := bare.FindStringSubmatch(line); m != nil {
        settings[m[1]] = strings.TrimSpace(m[2])
      }
    }
  }
  return settings, nil
}

type errMissingCaller struct{}

func (errMissingCaller) Error() string {
  return "runtime.Caller(0) returned ok=false; cannot locate structures/rules/"
}
