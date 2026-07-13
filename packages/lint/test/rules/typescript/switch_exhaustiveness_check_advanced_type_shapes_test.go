package linthost

import "testing"

// TestSwitchExhaustivenessCheckAdvancedTypeShapes verifies the checker walk
// preserves finite atoms through aliases, intersections, generic constraints,
// and namespace-qualified enums.
//
//  1. Check incomplete advanced shapes and open types in one focused run.
//  2. Check their complete counterparts separately and require no findings.
//  3. Keep never aligned with upstream's non-literal default policy.
func TestSwitchExhaustivenessCheckAdvancedTypeShapes(t *testing.T) {
  assertSwitchExhaustivenessCheckForTest(t, `
type Alias = "alias-a" | "alias-b";
declare const aliasIncomplete: Alias;
switch (aliasIncomplete) { case "alias-a": break; }

declare const brand: unique symbol;
type Brand = { readonly [brand]: true };
type Branded = ("plain" & Brand) | ("branded-right" & Brand);
declare const brandedIncomplete: Branded;
switch (brandedIncomplete) { case "plain": break; }

function genericIncomplete<T extends "left" | "right">(value: T): void {
  switch (value) { case "left": break; }
}

namespace Domain {
  export enum Mode { Ready, Done }
}
declare const namespaceIncomplete: Domain.Mode;
switch (namespaceIncomplete) { case Domain.Mode.Ready: break; }

declare const openValue: string & Brand;
switch (openValue) { case "known": break; }

declare const impossible: never;
switch (impossible) {}
`, map[string]any{
    "requireDefaultForNonUnion": true,
  }, 6, map[string]int{
    `Cases not matched: "alias-b"`:        1,
    `Cases not matched: "branded-right"`:  1,
    `Cases not matched: "right"`:          1,
    "Cases not matched: Domain.Mode.Done": 1,
    "Cases not matched: default":          2,
  })

  assertSwitchExhaustivenessCheckForTest(t, `
type Alias = "alias-a" | "alias-b";
declare const aliasComplete: Alias;
switch (aliasComplete) { case "alias-a": break; case "alias-b": break; }

declare const brand: unique symbol;
type Brand = { readonly [brand]: true };
type Branded = ("plain" & Brand) | ("branded-right" & Brand);
declare const brandedComplete: Branded;
switch (brandedComplete) { case "plain": break; case "branded-right": break; }

function genericComplete<T extends "left" | "right">(value: T): void {
  switch (value) { case "left": break; case "right": break; }
}

namespace Domain {
  export enum Mode { Ready, Done }
}
declare const namespaceComplete: Domain.Mode;
switch (namespaceComplete) { case Domain.Mode.Ready: break; case Domain.Mode.Done: break; }

declare const openValue: string & Brand;
switch (openValue) { case "known": break; default: break; }

declare const impossible: never;
switch (impossible) { default: break; }
`, map[string]any{
    "requireDefaultForNonUnion": true,
  }, 0, nil)
}
