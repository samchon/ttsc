package linthost

import "testing"

// TestFixNoExtraBindRemovesSafeMemberAndCallSyntax verifies the autofix
// preserves grouping and comments outside the discarded bind syntax.
//
// Removing the whole call node would also erase comments between the function
// and member operator. Two precise edits retain those bytes while supporting
// computed properties and optional member/call forms.
//
// 1. Bind literal and function-expression receivers.
// 2. Keep comments immediately before the member and after the call.
// 3. Assert only the bind member and its call arguments disappear.
//
// @evidence contracts/testing.md#behavioral-verification no-extra-bind removes only safe bind member/call syntax across direct, computed, optional and function-receiver shapes.
// @evidence contracts/testing.md#independent-expectations The full literal result retains each return value, grouping and comments outside deleted syntax; a whole-node deletion or receiver corruption differs.
// @evidence contracts/testing.md#distinguishing-cases Pure receivers allow automatic removal; effectful receivers and comments inside deleted ranges are the negative twins in TestFixNoExtraBindSkipsEffectfulOrCommentedRemovals.
// @evidence contracts/testing.md#execution-ownership TestFixNoExtraBindRemovesSafeMemberAndCallSyntax calls assertFixSnapshot over eight bind declarations and one unchanged declared receiver; Engine and the disk edit applier execute in process.
func TestFixNoExtraBindRemovesSafeMemberAndCallSyntax(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-bind",
    `declare const receiver: unknown;
const direct = (function () { return 1; }).bind(null);
const computed = (function () { return 2; })["bind"](null);
const template = (function () { return 3; })[`+"`bind`"+`](true);
const optionalMember = (function () { return 4; })?.["bind"](null);
const optionalCall = (function () { return 5; }.bind)?.(null);
const leadingComment = (function () { return 6; })/* keep */.bind(null);
const trailingComment = (function () { return 7; }).bind(null)/* keep */;
const functionReceiver = (function () { return 8; }).bind(function receiverFunction() {});
`,
    `declare const receiver: unknown;
const direct = (function () { return 1; });
const computed = (function () { return 2; });
const template = (function () { return 3; });
const optionalMember = (function () { return 4; });
const optionalCall = (function () { return 5; });
const leadingComment = (function () { return 6; })/* keep */;
const trailingComment = (function () { return 7; })/* keep */;
const functionReceiver = (function () { return 8; });
`,
  )
}
