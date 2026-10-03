package linthost

import (
  "sort"
  "testing"
)

// TestRuleCodesAreUniqueAndBandedAcrossLiveRegistry verifies the built-in code
// ledger and the codes RuleCode resolves for every loaded rule identity occupy
// one collision-free code space inside the reserved band.
//
// The ledger keeps tombstones for removed rules, so it can hold more names than
// the registry; every active built-in must still appear in it, while runtime
// contributor adapters are allowed to live outside it.
//
//  1. Walk the built-in ledger and require each code to be in band and unused.
//  2. Require every registered rule that is not a contributor adapter to have a
//     ledger entry.
//  3. Resolve RuleCode for every file-rule and project-rule identity, once per
//     name, and require in-band, pairwise-distinct codes.
//
// @evidence contracts/testing.md#behavioral-verification The built-in ledger map is walked for out-of-band and shared codes; every registered non-contributor rule must have a ledger entry; and RuleCode resolved for each distinct file or project rule identity must be inside the reserved band with no two identities sharing a code.
// @evidence contracts/testing.md#independent-expectations The reserved interval [9000,18000) and uniqueness across different rule identities are the protocol; the test names no production rule and no specific code, so it passes or fails on the allocator and ledger data, not on a copied snapshot.
// @evidence contracts/testing.md#distinguishing-cases Ledger tombstones are checked for uniqueness although they are not registered, a built-in rule that has both file and project forms is counted once by identity, and contributor adapters are excluded from the ledger-membership requirement; the registry must be nonempty so an empty population cannot pass.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRuleCodesAreUniqueAndBandedAcrossLiveRegistry calls the live registries and RuleCode in the shared linthost test process; the ledger is compatibility data read through its Go map, and no file, native artifact, installation or subprocess is involved.
func TestRuleCodesAreUniqueAndBandedAcrossLiveRegistry(t *testing.T) {
  ledgerCodes := make(map[int32]string, len(builtInRuleCodes))
  for name, code := range builtInRuleCodes {
    if code < 9000 || code >= 18000 {
      t.Fatalf("built-in rule %q has out-of-range code %d", name, code)
    }
    if previous, exists := ledgerCodes[code]; exists {
      t.Fatalf("built-in rules %q and %q share code %d", previous, name, code)
    }
    ledgerCodes[code] = name
  }

  fileRuleNames := AllRuleNames()
  if len(fileRuleNames) == 0 {
    t.Fatal("registered file-rule population must not be empty")
  }
  for _, name := range fileRuleNames {
    if _, frozen := builtInRuleCodes[name]; frozen {
      continue
    }
    switch LookupRule(name).(type) {
    case contributorAdapter, formatContributorAdapter:
      // Runtime contributors are deliberately absent from the built-in ledger.
    default:
      t.Fatalf("registered rule %q is neither in the built-in ledger nor a contributor adapter", name)
    }
  }

  allNames := append(append([]string(nil), fileRuleNames...), allProjectRuleNames()...)
  sort.Strings(allNames)
  activeCodes := make(map[int32]string, len(allNames))
  seenNames := make(map[string]struct{}, len(allNames))
  for _, name := range allNames {
    // A built-in project companion is a second lifecycle for the same public
    // identity and resolves to the same ledger entry, so count it once.
    if _, seen := seenNames[name]; seen {
      continue
    }
    seenNames[name] = struct{}{}
    code := RuleCode(name)
    if code < 9000 || code >= 18000 {
      t.Fatalf("rule %q has out-of-range code %d", name, code)
    }
    if previous, exists := activeCodes[code]; exists {
      t.Fatalf("rules %q and %q share code %d", previous, name, code)
    }
    activeCodes[code] = name
  }
}
