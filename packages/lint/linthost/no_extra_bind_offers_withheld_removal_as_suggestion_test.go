package linthost

import "testing"

// TestNoExtraBindOffersWithheldRemovalAsSuggestion verifies a comment inside
// the bind syntax downgrades the removal to an opt-in suggestion while an
// effectful receiver still yields no action at all.
//
// The two withhold reasons are not interchangeable. A comment in the deleted
// member/call ranges makes the edit lossy, which an author may accept once
// told; an effectful receiver like `makeReceiver()` makes it wrong, because
// deleting the bind deletes a call the program performs. Only the first may
// reach the suggestion channel, so both arms are pinned together.
//
//  1. Report on `(function () { return 4; })./**/bind(null)` and assert no autofix.
//  2. Assert the single suggestion strips the bind syntax and the comment.
//  3. Assert an effectful receiver offers neither a fix nor a suggestion.
//  4. Assert the comment-free twin is still autofixed without asking.
//
// @evidence contracts/testing.md#behavioral-verification Actual edit helpers compare opt-in comment removal, zero actions for an effectful receiver and direct fixing for the pure comment-free twin.
// @evidence contracts/testing.md#independent-expectations Literal target sources preserve the function body and surrounding code; deleting a makeReceiver call loses an independently observable effect, while comment deletion requires explicit user choice.
// @evidence contracts/testing.md#distinguishing-cases Lossy comment removal is suggestion-only; receiver side effects block all actions; the comment-free pure receiver fixes automatically.
// @evidence contracts/testing.md#execution-ownership TestNoExtraBindOffersWithheldRemovalAsSuggestion is selected in the shared Go unit population. It calls assertSuggestionSnapshot, assertReportOnlySnapshot and assertFixSnapshot, applying actual rule edits in the shared Go process. No consumer install, native artifact build or real host runs.
func TestNoExtraBindOffersWithheldRemovalAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "no-extra-bind",
    "declare const receiver: { value: unknown };\nconst bound = (function () { return 4; })./**/bind(null);\nJSON.stringify(bound);\n",
    "Remove the unnecessary binding, discarding the comment inside it.",
    "declare const receiver: { value: unknown };\nconst bound = (function () { return 4; });\nJSON.stringify(bound);\n",
  )
  assertReportOnlySnapshot(
    t,
    "no-extra-bind",
    "declare function makeReceiver(): unknown;\nconst bound = (function () { return 4; }).bind(makeReceiver());\nJSON.stringify(bound);\n",
  )
  assertFixSnapshot(
    t,
    "no-extra-bind",
    "declare const receiver: { value: unknown };\nconst bound = (function () { return 4; }).bind(null);\nJSON.stringify(bound);\n",
    "declare const receiver: { value: unknown };\nconst bound = (function () { return 4; });\nJSON.stringify(bound);\n",
  )
}
