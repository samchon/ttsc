package linthost

import "testing"

// TestPreferTemplateDeclinesFixWhenCommentInConcatSpan verifies the
// prefer-template autofix is withheld when a comment sits inside the
// concatenation it would rewrite as a single template literal, so the comment
// is preserved instead of dropped.
//
// The fix replaces the whole `+` chain span with one template literal, so a
// comment anywhere inside (`"hi " + /* keep */ who`) would be erased. ESLint's
// prefer-template declines via `commentsExistBetween`; the port imposes no edit
// either and routes the rendered literal to the opt-in suggestion channel
// instead (pinned by `TestPreferTemplateOffersWithheldTemplateAsSuggestion`).
// The negative twin — the same concatenation
// with no comment — must still become a template literal, proving the guard is
// scoped to the comment.
//
//  1. Report on `"hi " + /* keep */ who` and assert no edit is applied.
//  2. Assert the comment-free twin still becomes the template “ `hi ${"" + (who)}` “.
//  3. Assert a `//`-bearing string operand (`"https://" + host`) still fixes,
//     since the seam scan must not misread string content as a comment.
//
// @evidence contracts/testing.md#behavioral-verification Withholds automatic replacement over a real seam comment but fixes comment-free concatenation and a URL literal.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
//
// @evidence contracts/testing.md#independent-expectations The authored output literals preserve concatenation meaning; comments require preservation, while // inside https:// is literal content.
// @evidence contracts/testing.md#distinguishing-cases Real block comment, no comment and slash-text literal distinguish seam parsing and fix safety.
// @evidence contracts/testing.md#execution-ownership assertNoFixSnapshot owns the real-comment no-rewrite source; assertFixSnapshot runs and applies fixes for the no-comment and URL-literal sources. All three invocations belong to this Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestPreferTemplateDeclinesFixWhenCommentInConcatSpan(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "prefer-template",
    "const who = \"world\";\nconst s = \"hi \" + /* keep */ who;\nJSON.stringify(s);\n",
  )
  assertFixSnapshot(
    t,
    "prefer-template",
    "const who = \"world\";\nconst s = \"hi \" + who;\nJSON.stringify(s);\n",
    "const who = \"world\";\nconst s = `hi ${\"\" + (who)}`;\nJSON.stringify(s);\n",
  )
  // A string literal containing `//` must not trip the seam scan into
  // declining: the slashes are string content, not a comment.
  assertFixSnapshot(
    t,
    "prefer-template",
    "const host = \"example.com\";\nconst s = \"https://\" + host;\nJSON.stringify(s);\n",
    "const host = \"example.com\";\nconst s = `https://${\"\" + (host)}`;\nJSON.stringify(s);\n",
  )
}
