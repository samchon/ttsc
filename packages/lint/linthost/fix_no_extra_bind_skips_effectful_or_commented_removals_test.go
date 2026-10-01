package linthost

import "testing"

// TestFixNoExtraBindSkipsEffectfulOrCommentedRemovals verifies diagnostics do
// not become behavior-changing or comment-dropping automatic edits.
//
// Evaluating the bound receiver can call code, access a getter, or mutate
// state. Comments inside the member/call syntax also carry source information
// that a deletion cannot safely relocate. Neither shape may reach `ttsc fix`;
// the commented shapes are separately offered as opt-in suggestions, pinned by
// `TestNoExtraBindOffersWithheldRemovalAsSuggestion`.
//
// 1. Bind call, member-access, and update expressions as receivers.
// 2. Place comments inside dot, computed-key, and argument syntax.
// 3. Assert all calls report without changing any source byte.
//
// @evidence contracts/testing.md#behavioral-verification no-extra-bind reports all six effectful/commented calls at their exact spans and applies no automatic rewrite.
// @evidence contracts/testing.md#independent-expectations Six independently spelled call markers and the original full source require each diagnostic and preserve calls, getters, updates and comments.
// @evidence contracts/testing.md#distinguishing-cases Call/member/update receivers and dot/key/argument comments all withhold autofix; safe comment-free receiver removal belongs to the companion fixing test.
// @evidence contracts/testing.md#execution-ownership TestFixNoExtraBindSkipsEffectfulOrCommentedRemovals calls assertNoFixSnapshot and assertRuleFindingRanges on its literal six-call fixture in the Go unit process.
func TestFixNoExtraBindSkipsEffectfulOrCommentedRemovals(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-extra-bind",
    `declare function makeReceiver(): unknown;
declare const receiver: { value: unknown };
let index = 0;
const called = (function () { return 1; }).bind(makeReceiver());
const accessed = (function () { return 2; }).bind(receiver.value);
const updated = (function () { return 3; }).bind(index++);
const dotComment = (function () { return 4; })./**/bind(receiver);
const keyComment = (function () { return 5; })["bind"/**/](receiver);
const argumentComment = (function () { return 6; }).bind(/**/receiver);
`,
  )
  assertRuleFindingRanges(t, "no-extra-bind", `declare function makeReceiver(): unknown;
declare const receiver: { value: unknown };
let index = 0;
const called = (function () { return 1; }).bind(makeReceiver());
const accessed = (function () { return 2; }).bind(receiver.value);
const updated = (function () { return 3; }).bind(index++);
const dotComment = (function () { return 4; })./**/bind(receiver);
const keyComment = (function () { return 5; })["bind"/**/](receiver);
const argumentComment = (function () { return 6; }).bind(/**/receiver);
`,
    "(function () { return 1; }).bind(makeReceiver())",
    "(function () { return 2; }).bind(receiver.value)",
    "(function () { return 3; }).bind(index++)",
    "(function () { return 4; })./**/bind(receiver)",
    "(function () { return 5; })[\"bind\"/**/](receiver)",
    "(function () { return 6; }).bind(/**/receiver)",
  )
}
