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
// Round-1 review (Agent A) found zero drift today, but the surface
// is ~470 rules and growing. A new rule added in Go without a typed
// counterpart would only surface as a silent autocomplete miss; a new
// typed key without a Go registration would silently no-op at runtime.
// This test makes both sides honest at build time.
//
// `format/*` rules are deliberately registered in Go but absent from
// the typed `rules` surface — formatter behavior is configured through
// `ITtscLintFormat` (the top-level `format` block). They are filtered
// out before the diff.
//
// `test/*` is reserved for in-test stubs (e.g. the
// `duplicate-guard-sentinel` used by
// `TestRegisterRejectsDuplicateRuleName`). Any name under that prefix
// is also filtered out before the diff so the parity check does not
// flap when other registry tests run in the same binary.
//
// `demo/*` is the upstream-facing contributor-plugin example namespace;
// the in-tree tests under `test/plugin/` register their own `demo/*`
// stubs that exist only at test time. These are not part of the public
// rules surface and are filtered out as well.
//
//  1. Walk every `ITtscLint*Rules.ts` file under
//     `packages/lint/src/structures/rules/`.
//  2. Extract every property key matching `"<id>"?` — either quoted
//     kebab-case form. Bare-identifier keys are also accepted because
//     three Core keys historically used the bare form.
//  3. Compare the typed-key set against `AllRuleNames()` filtered as
//     above. Report missing-from-TS and missing-from-Go separately so
//     the failure points at the side that drifted.
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

// registeredRuleSetForParity returns the canonical rule-name set used
// by the parity check: everything from `AllRuleNames()` minus the
// formatter-internal `format/*` ids and the test-only `test/*` ids.
func registeredRuleSetForParity() map[string]struct{} {
  out := make(map[string]struct{}, len(AllRuleNames()))
  for _, name := range AllRuleNames() {
    if strings.HasPrefix(name, "format/") ||
      strings.HasPrefix(name, "test/") ||
      strings.HasPrefix(name, "demo/") {
      continue
    }
    out[name] = struct{}{}
  }
  return out
}

// readTypedRuleKeys scans `packages/lint/src/structures/rules/`
// relative to this test file and pulls out every property key in
// every family interface.
func readTypedRuleKeys() (map[string]struct{}, error) {
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
  keys := make(map[string]struct{})
  quoted := regexp.MustCompile(`^\s*"([\w][\w/-]*)"\?\s*:`)
  bare := regexp.MustCompile(`^\s*([a-zA-Z_$][\w]*)\?\s*:\s*Ttsc`)
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
        keys[m[1]] = struct{}{}
        continue
      }
      if m := bare.FindStringSubmatch(line); m != nil {
        keys[m[1]] = struct{}{}
      }
    }
  }
  return keys, nil
}

type errMissingCaller struct{}

func (errMissingCaller) Error() string {
  return "runtime.Caller(0) returned ok=false; cannot locate structures/rules/"
}
