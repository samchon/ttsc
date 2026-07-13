package linthost

import "testing"

// TestSwitchExhaustivenessCheckFiniteMembers verifies every finite value family
// is enumerated and that regularized case types cover their matching members.
//
//  1. Check every incomplete literal family together and assert all names.
//  2. Check every complete counterpart separately and require no findings.
//  3. Keep enum and unique-symbol identity distinct from equal-looking values.
func TestSwitchExhaustivenessCheckFiniteMembers(t *testing.T) {
  assertSwitchExhaustivenessCheckForTest(t, `
declare const singletonIncomplete: "only";
switch (singletonIncomplete) {}

declare const numberIncomplete: 1 | 42;
switch (numberIncomplete) { case 1: break; }

enum Mode { Ready, Done }
declare const enumIncomplete: Mode;
switch (enumIncomplete) { case Mode.Ready: break; }

declare const booleanIncomplete: boolean;
switch (booleanIncomplete) { case false: break; }

declare const bigintIncomplete: 1n | 2n;
switch (bigintIncomplete) { case 1n: break; }

declare const nullishIncomplete: null | undefined;
switch (nullishIncomplete) { case null: break; }

declare const first: unique symbol;
declare const second: unique symbol;
declare const symbolIncomplete: typeof first | typeof second;
switch (symbolIncomplete) { case first: break; }
`, nil, 7, map[string]int{
    `Cases not matched: "only"`:   1,
    "Cases not matched: 42":       1,
    "Cases not matched: Mode.Done": 1,
    "Cases not matched: true":     1,
    "Cases not matched: 2n":       1,
    "Cases not matched: undefined": 1,
    "Cases not matched: typeof second": 1,
  })

  assertSwitchExhaustivenessCheckForTest(t, `
declare const singletonComplete: "only";
switch (singletonComplete) { case "only": break; }

declare const numberComplete: 1 | 42;
switch (numberComplete) { case 1: break; case 42: break; }

enum Mode { Ready, Done }
declare const enumComplete: Mode;
switch (enumComplete) { case Mode.Ready: break; case Mode.Done: break; }

declare const booleanComplete: boolean;
switch (booleanComplete) { case false: break; case true: break; }

declare const bigintComplete: 1n | 2n;
switch (bigintComplete) { case 1n: break; case 2n: break; }

declare const nullishComplete: null | undefined;
switch (nullishComplete) { case null: break; case undefined: break; }

declare const first: unique symbol;
declare const second: unique symbol;
declare const symbolComplete: typeof first | typeof second;
switch (symbolComplete) { case first: break; case second: break; }
`, nil, 0, nil)
}
