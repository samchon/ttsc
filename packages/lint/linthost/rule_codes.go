package linthost

import (
  _ "embed"
  "encoding/json"
  "fmt"
  "sort"
  "sync"

  "github.com/samchon/ttsc/packages/lint/internal/rulecode"
)

//go:generate go run ../tools/rulecodes -root ..

// ruleCodeLedgerJSON is the append-only compatibility ledger for built-in
// rules. Removed names stay in the ledger so their codes are never reused.
//
//go:embed rule_codes.json
var ruleCodeLedgerJSON []byte

var builtInRuleCodes = mustLoadBuiltInRuleCodes()

var runtimeRuleCodes = struct {
  sync.Mutex
  codes map[string]int32
  dirty bool
}{dirty: true}

func mustLoadBuiltInRuleCodes() map[string]int32 {
  var ledger map[string]int32
  if err := json.Unmarshal(ruleCodeLedgerJSON, &ledger); err != nil {
    panic(fmt.Sprintf("@ttsc/lint: parse rule code ledger: %v", err))
  }
  if len(ledger) == 0 {
    panic("@ttsc/lint: rule code ledger is empty; restore it from version control")
  }
  validated, err := rulecode.Allocate(ledger, nil)
  if err != nil {
    panic(fmt.Sprintf("@ttsc/lint: invalid rule code ledger: %v", err))
  }
  return validated
}

// invalidateRuntimeRuleCodes marks the contributed-rule assignment stale.
// Register calls it only for names absent from the frozen built-in ledger.
func invalidateRuntimeRuleCodes() {
  runtimeRuleCodes.Lock()
  runtimeRuleCodes.dirty = true
  runtimeRuleCodes.Unlock()
}

// RuleCode returns the collision-free positive TS-style code for a rule.
// Built-in assignments come from the append-only ledger. Runtime contributor
// assignments are recomputed over the complete sorted contributor set, so the
// same set receives the same codes regardless of registration order.
//
// @evidence contracts/common.md#principled-implementation Frozen built-in assignments are preserved while complete sorted contributor names receive collision-free assignments from the same reserved code interval.
// @evidence contracts/common.md#clear-and-simple-design One public lookup centralizes the compatibility ledger and invalidated runtime allocation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The append-only ledger is explicit diagnostic compatibility data; contributors use the allocator instead of name-specific code exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains built-in stability and registration-order independence; separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RuleCode maps rule names to diagnostic codes and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms A built-in name is one map lookup; a runtime-registered name triggers one sort and one rulecode.Allocate over the registered names.
// @evidence contracts/performance.md#reuse-equivalent-work Runtime assignments are cached under a mutex and recomputed only when the table is marked dirty or the queried name is not yet registered.
// @evidence contracts/performance.md#bound-retention-and-release-resources The table keeps one entry per registered rule and is rebuilt wholesale on recomputation, so no stale entry survives; the mutex is released by defer.
func RuleCode(name string) int32 {
  if code, exists := builtInRuleCodes[name]; exists {
    return code
  }

  runtimeRuleCodes.Lock()
  defer runtimeRuleCodes.Unlock()
  _, isFileRule := registered.rules[name]
  _, isProjectRule := registeredProjectRules[name]
  isRegistered := isFileRule || isProjectRule
  if !runtimeRuleCodes.dirty && isRegistered {
    if code, exists := runtimeRuleCodes.codes[name]; exists {
      return code
    }
  }

  names := make([]string, 0, len(registered.rules)+1)
  for registeredName := range registered.rules {
    if _, builtIn := builtInRuleCodes[registeredName]; !builtIn {
      names = append(names, registeredName)
    }
  }
  for registeredName := range registeredProjectRules {
    if _, builtIn := builtInRuleCodes[registeredName]; !builtIn {
      names = append(names, registeredName)
    }
  }
  if !isRegistered {
    names = append(names, name)
  }
  sort.Strings(names)
  assigned, err := rulecode.Allocate(builtInRuleCodes, names)
  if err != nil {
    panic(fmt.Sprintf("@ttsc/lint: allocate diagnostic code for %q: %v", name, err))
  }

  runtimeRuleCodes.codes = make(map[string]int32, len(names))
  for _, registeredName := range names {
    _, fileRule := registered.rules[registeredName]
    _, projectRule := registeredProjectRules[registeredName]
    if fileRule || projectRule {
      runtimeRuleCodes.codes[registeredName] = assigned[registeredName]
    }
  }
  runtimeRuleCodes.dirty = false
  return assigned[name]
}

// ruleCode is the internal alias used by native diagnostic construction.
func ruleCode(name string) int32 { return RuleCode(name) }
