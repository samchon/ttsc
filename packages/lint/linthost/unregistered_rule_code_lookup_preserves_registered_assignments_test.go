package linthost

import (
  "fmt"
  "hash/fnv"
  "testing"
)

// TestUnregisteredRuleCodeLookupPreservesRegisteredAssignments verifies a
// temporary name lookup cannot renumber an unchanged loaded contributor set.
//
// An unknown name may be queried without being registered. Its provisional
// allocation must not become the cached assignment for the real registry,
// whether that registry's allocation was already cached or remains dirty.
//
//  1. Prepare colliding names whose preferred slot is not currently reserved.
//  2. Register the later name as either a file or project rule, cold or cached.
//  3. Query the earlier unknown name twice and require every loaded code to stay.
//
// @evidence contracts/testing.md#behavioral-verification Public RuleCode receives a colliding unregistered name before or after the registered contributor's first lookup; that contributor retains its independently derived preferred code and all earlier loaded identities retain their assignments.
// @evidence contracts/testing.md#independent-expectations README's unchanged complete loaded contributor set determines code stability. Standard-library FNV-1a and literal [9000,18000) prepare an unused preferred slot independently of rulecode.Legacy; the loaded later name must keep that preference, while unknown responses need only remain in band and repeat deterministically for the same temporary set.
// @evidence contracts/testing.md#distinguishing-cases The unknown colliding name sorts before the loaded name, exposing provisional-set cache pollution. File/project registrations each run cold and already cached; an unused preferred slot makes the loaded name's exact expected code independent of collision probes. Both registries reject preexisting fixture names, and deferred removal invalidates the shared cache.
// @evidence contracts/testing.md#execution-ownership This direct host unit calls RuleCode and public file Register or the project adapter registry in one Go process. Temporary collision input preparation uses standard FNV only; no filesystem, native producer, installed consumer or subprocess runs.
func TestUnregisteredRuleCodeLookupPreservesRegisteredAssignments(t *testing.T) {
  previousCodes := make(map[string]int32)
  reserved := make(map[int32]bool)
  for _, code := range builtInRuleCodes {
    reserved[code] = true
  }
  for name := range registered.rules {
    previousCodes[name] = RuleCode(name)
    reserved[previousCodes[name]] = true
  }
  for name := range registeredProjectRules {
    previousCodes[name] = RuleCode(name)
    reserved[previousCodes[name]] = true
  }
  seen := make(map[int32]string)
  var unknown, loaded string
  var expected int32
  for index := 0; index < 20000; index++ {
    name := fmt.Sprintf("contributor/query-cache-%05d", index)
    if LookupRule(name) != nil {
      t.Fatalf("fixture file-rule identity is already registered: %q", name)
    }
    if _, exists := registeredProjectRules[name]; exists {
      t.Fatalf("fixture project-rule identity is already registered: %q", name)
    }
    if _, exists := builtInRuleCodes[name]; exists {
      t.Fatalf("fixture identity is in the frozen ledger: %q", name)
    }
    hash := fnv.New32a()
    _, _ = hash.Write([]byte(name))
    preferred := int32(9000 + hash.Sum32()%9000)
    if reserved[preferred] {
      continue
    }
    if previous, exists := seen[preferred]; exists {
      unknown, loaded, expected = previous, name, preferred
      break
    }
    seen[preferred] = name
  }
  if unknown == "" || loaded == "" || unknown >= loaded {
    t.Fatal("failed to prepare an ordered collision in an unused preferred slot")
  }
  for _, family := range []string{"file", "project"} {
    for _, warm := range []bool{false, true} {
      t.Run(fmt.Sprintf("%s/cached=%t", family, warm), func(t *testing.T) {
        if family == "file" {
          Register(runtimeRuleCodeTestRule{name: loaded})
        } else {
          registeredProjectRules[loaded] = projectRuleAdapter{name: loaded}
          invalidateRuntimeRuleCodes()
        }
        defer func() {
          delete(registered.rules, loaded)
          delete(registeredProjectRules, loaded)
          invalidateRuntimeRuleCodes()
        }()
        if warm {
          if code := RuleCode(loaded); code != expected {
            t.Fatalf("loaded contributor preference: want %d, got %d", expected, code)
          }
        }
        first := RuleCode(unknown)
        second := RuleCode(unknown)
        if first < 9000 || first >= 18000 || first != second {
          t.Fatalf("temporary lookup is out of band or unstable: %d, %d", first, second)
        }
        if code := RuleCode(loaded); code != expected {
          t.Fatalf("unknown lookup renumbered loaded contributor: want %d, got %d", expected, code)
        }
        for name, expectedCode := range previousCodes {
          if code := RuleCode(name); code != expectedCode {
            t.Fatalf("unknown lookup changed prior identity %q: want %d, got %d", name, expectedCode, code)
          }
        }
      })
    }
  }
}
