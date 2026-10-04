package linthost

import "testing"

// TestSwitchExhaustivenessCheckFiniteMembers verifies seven authored finite families
// is enumerated and that regularized case types cover their matching members.
//
//  1. Check the seven incomplete families together and assert all missing names.
//  2. Check every complete counterpart separately and require no findings.
//  3. Pin enum and unique-symbol alternatives by their independently named members.
//
// @evidence contracts/testing.md#behavioral-verification The actual check command enumerates the missing members of these seven authored finite type families and accepts their complete counterparts.
// @evidence contracts/testing.md#independent-expectations Seven authored missing-member messages require only, 42, Mode.Done, true, 2n, undefined and typeof second once each; the completed program requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases Singleton, number, enum, boolean, bigint, nullish and unique-symbol unions each have an exhaustive counterpart.
// @evidence contracts/testing.md#execution-ownership TestSwitchExhaustivenessCheckFiniteMembers executes the in-process check command with real Program/Checker through the shared switch oracle; every original source/options/assertion remains and no compiler child, installation or native build runs.
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
    `Cases not matched: "only"`:        1,
    "Cases not matched: 42":            1,
    "Cases not matched: Mode.Done":     1,
    "Cases not matched: true":          1,
    "Cases not matched: 2n":            1,
    "Cases not matched: undefined":     1,
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
