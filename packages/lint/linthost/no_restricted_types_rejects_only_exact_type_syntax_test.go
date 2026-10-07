package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedTypesRejectsOnlyExactTypeSyntax verifies bans do not leak into
// runtime code or partially matching names.
//
// Only the exact banned type syntax is restricted.
//
//  1. Parse runtime expressions and look-alike types such as qualified prefixes and
//     suffixes, wrong generic arguments, nonempty tuples and objects and runtime
//     heritage.
//  2. Run the rule with explicit bans.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Type bans must not leak into runtime expressions or partially matching names.
// @evidence contracts/testing.md#independent-expectations Explicit bans applied to the authored runtime and mismatching type program must yield zero findings.
// @evidence contracts/testing.md#distinguishing-cases Qualified prefixes/suffixes, wrong generic arguments, nonempty tuple/object and runtime heritage distinguish exact syntax from lookalikes.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesRejectsOnlyExactTypeSyntax invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshot; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesRejectsOnlyExactTypeSyntax(t *testing.T) {
  source := `
const runtime = Object();
const created = Object.create(null);
const nullValue = null;
const voidValue = void runtime;
type Query = typeof Banned;
type QualifiedMiss = namespace.Object;
type PrefixMiss = _.NS.Banned;
type SuffixMiss = NS.Banned._;
type GenericMiss = Generic<Other>;
type NonEmptyTuple = [Other];
type NonEmptyObject = { value: Other };
declare class RuntimeBase {}
class RuntimeDerived extends RuntimeBase {}
JSON.stringify({ created, nullValue, voidValue });
`
  options := json.RawMessage(`{
    "types": {
      "Object": true,
      "null": true,
      "void": true,
      "Banned": true,
      "NS.Banned": true,
      "Generic<Wanted>": true,
      "[]": true,
      "{}": true,
      "RuntimeBase": true
    }
  }`)
  if findings := runNoRestrictedTypes(t, source, options); len(findings) != 0 {
    t.Fatalf("non-type or inexact matches produced findings: %+v", findings)
  }
}
