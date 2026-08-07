package evidence

import (
  "strings"
  "testing"
)

// reviewedProject builds one project whose single citation carries the
// fingerprint the graph currently expects for it.
//
// The expected value is read out of the graph's own diagnostic rather than
// written as a literal. A literal would lock in whatever the digest happens to
// emit today, which is the snapshot bias the development skill forbids: the
// property under test is that the value *changes with the content*, and a
// hard-coded hash proves only that the code agrees with itself.
func reviewedFingerprint(t *testing.T, document string, source string) string {
  t.Helper()
  return reviewedFingerprintAt(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": source,
  }, requireReviewConfig)
}

// reviewedFingerprintAt is the same reading for an arbitrary project shape.
//
// The scan cannot simply take the first `#` in the message. Every one of these
// diagnostics names the cited target too, and a Markdown target carries its own
// anchor — `for 'docs/spec.md#pricing'` — so the first `#` is the anchor's and
// the helper would return `pricing` as the fingerprint. Every case built on it
// would then write a citation whose fingerprint is a word, and they would fail
// as stale rather than as a broken helper, which is the wrong failure to debug.
//
// The token is identified by its shape instead: `#` followed by exactly
// `reviewFingerprintLength` lowercase hex characters, ending at whitespace, a
// quote, or the end of the message. That is the same discrimination
// `splitReviewFingerprint` performs on a tag.
func reviewedFingerprintAt(
  t *testing.T,
  files map[string]string,
  config string,
) string {
  t.Helper()
  messages := runIndexRule(t, files, config)
  for _, message := range messages {
    if !strings.Contains(message, "@evidenceReview") {
      continue
    }
    if found := fingerprintWithin(message); found != "" {
      return found
    }
  }
  t.Fatalf(
    "expected a review diagnostic naming the expected fingerprint, got:\n%s",
    strings.Join(messages, "\n"),
  )
  return ""
}

// fingerprintWithin finds the first shaped fingerprint token in a message.
func fingerprintWithin(message string) string {
  for index := 0; index < len(message); index++ {
    if message[index] != '#' {
      continue
    }
    candidate := message[index+1:]
    if len(candidate) < reviewFingerprintLength {
      continue
    }
    token := candidate[:reviewFingerprintLength]
    if !isLowerHex(token) {
      continue
    }
    if len(candidate) == reviewFingerprintLength {
      return token
    }
    switch candidate[reviewFingerprintLength] {
    case ' ', '\t', '\n', '\'', '"', '.', ',', ')':
      return token
    }
  }
  return ""
}

const requireReviewConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"type",
  "reference":{
    "type":"markdown",
    "files":["docs/**/*.md"],
    "symbol":"h2",
    "requireReview":true
  }
}]}`

/**
 * Verifies a review passes while the cited content stands and fails once it
 * moves.
 *
 * This is the transformation direction, which is the whole product: a review
 * that never expires is written once and stays green forever, and on a second
 * pass over a large citation set nothing distinguishes a review written against
 * current content from one written against content that has since been rewritten.
 * Asserting only that a correct fingerprint passes would prove idempotency
 * instead.
 *
 *  1. Cite one H2 and review it with the fingerprint the graph asks for.
 *  2. Assert the graph is clean.
 *  3. Rewrite the body of that H2 and assert the same source now reports a stale
 *     review naming both the old and the new value.
 */
func TestRequireReviewExpiresOnCitedContent(t *testing.T) {
  before := "## Pricing\n\nThe rate is capped at 30%.\n"
  bare := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`
  fingerprint := reviewedFingerprint(t, before, bare)
  reviewed := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #` + fingerprint + ` Section caps the rate at 30%; price clamps to 30.
 */
export interface ISale {
  price: number;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": before,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig))

  after := "## Pricing\n\nThe rate is capped at 45%.\n"
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": after,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig)
  assertProblemContains(t, messages, "Stale @evidenceReview for 'docs/spec.md#pricing'")
  assertProblemContains(t, messages, "names '#"+fingerprint+"'")
}

/**
 * Verifies a reformat that changes no content does not expire a review.
 *
 * The negative twin of the case above, and the one that decides whether the
 * feature is usable. A digest over raw bytes expires every review in a project
 * the first time someone runs a formatter, or the first time the repository is
 * checked out with a different `core.autocrlf`, and a rule that cries wolf on a
 * whitespace change gets switched off.
 *
 *  1. Take the fingerprint for one document.
 *  2. Re-emit the same document with CRLF line endings and trailing spaces.
 *  3. Assert the graph stays clean, so the fingerprint was unchanged.
 */
func TestRequireReviewSurvivesReformatting(t *testing.T) {
  before := "## Pricing\n\nThe rate is capped at 30%.\n"
  bare := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`
  fingerprint := reviewedFingerprint(t, before, bare)
  reviewed := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #` + fingerprint + ` Section caps the rate at 30%; price clamps to 30.
 */
export interface ISale {
  price: number;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing  \r\n\r\nThe rate is capped at 30%.   \r\n\r\n",
    "src/ISale.ts": reviewed,
  }, requireReviewConfig))
}
