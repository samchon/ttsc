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
}
