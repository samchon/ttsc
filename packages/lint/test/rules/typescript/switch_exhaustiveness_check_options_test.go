package linthost

import "testing"

// TestSwitchExhaustivenessCheckOptions verifies the four options remain
// independent rather than collapsing every default-shaped construct into one
// early return.
//
//  1. Let considerDefaultExhaustiveForUnions suppress a finite missing member.
//  2. Reject only genuinely redundant defaults when allowDefaultCaseForExhaustiveSwitch is false.
//  3. Require defaults only for open branches while retaining finite missing diagnostics.
//  4. Recognize only the eligible trailing comment under the default or custom pattern.
func TestSwitchExhaustivenessCheckOptions(t *testing.T) {
  assertSwitchExhaustivenessCheckForTest(t, `
declare const value: "alpha" | "beta";
switch (value) {
  case "alpha":
    break;
  default:
    break;
}
`, map[string]any{
    "considerDefaultExhaustiveForUnions": true,
  }, 0, nil)

  assertSwitchExhaustivenessCheckForTest(t, `
declare const complete: "alpha" | "beta";
switch (complete) {
  case "alpha": break;
  case "beta": break;
  default: break;
}

declare const incomplete: "alpha" | "beta";
switch (incomplete) {
  case "alpha": break;
  default: break;
}

declare const openValue: string;
switch (openValue) {
  default: break;
}
`, map[string]any{
    "allowDefaultCaseForExhaustiveSwitch": false,
  }, 2, map[string]int{
    "The switch statement is exhaustive, so the default case is unnecessary.": 1,
    `Cases not matched: "beta"`: 1,
  })

  assertSwitchExhaustivenessCheckForTest(t, `
declare const openValue: string;
switch (openValue) {
  case "known": break;
}

declare const finite: "left" | "right";
switch (finite) {
  case "left": break;
  case "right": break;
}

declare const mixed: string | undefined;
switch (mixed) {
  case "known": break;
}
`, map[string]any{
    "requireDefaultForNonUnion": true,
  }, 3, map[string]int{
    "Cases not matched: default":   2,
    "Cases not matched: undefined": 1,
  })

  assertSwitchExhaustivenessCheckForTest(t, `
declare const openValue: string;
switch (openValue) {
  case "known": break;
  // No Default
}
`, map[string]any{
    "requireDefaultForNonUnion": true,
  }, 0, nil)

  assertSwitchExhaustivenessCheckForTest(t, `
declare const openValue: string;
switch (openValue) {
  case "known": break;
  // skip   default
}
`, map[string]any{
    "defaultCaseCommentPattern": "^skip\\s+default$",
    "requireDefaultForNonUnion": true,
  }, 0, nil)

  assertSwitchExhaustivenessCheckForTest(t, `
declare const earlier: string;
switch (earlier) {
  case "known": break;
  // No Default
  // not the final marker
}

declare const outside: string;
switch (outside) {
  case "known": break;
}
// No Default
`, map[string]any{
    "requireDefaultForNonUnion": true,
  }, 2, map[string]int{
    "Cases not matched: default": 2,
  })
}
