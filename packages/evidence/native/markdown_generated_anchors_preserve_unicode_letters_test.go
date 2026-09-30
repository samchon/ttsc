package evidence

import (
  "testing"
)

/**
 * Verifies generated anchors follow the documented Unicode and punctuation
 * normalization rather than an ASCII-only shortcut.
 *
 * International headings are ordinary evidence units. Dropping their letters
 * would produce an empty or unrelated target, while retaining punctuation
 * would contradict the public slug grammar and make citations unpredictable.
 *
 *  1. Generate slugs from Korean, accented Latin, punctuation, and whitespace.
 *  2. Compare the result with the public normalization rules.
 *  3. Assert meaningful letters remain and separators collapse once.
 *
 * @evidence contracts/testing.md#behavioral-verification markdownSlug exercises this case. Verifies generated anchors follow the documented Unicode and punctuation normalization rather than an ASCII-only shortcut.
 *
 * @evidence contracts/testing.md#independent-expectations The authored Korean/Latin/punctuation/whitespace table specifies the slug grammar independently of markdownSlug, retaining letters and collapsing separators.
 *
 * @evidence contracts/testing.md#distinguishing-cases Generate slugs from Korean, accented Latin, punctuation, and whitespace. Compare the result with the public normalization rules. Assert meaningful letters remain and separators collapse once.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownGeneratedAnchorsPreserveUnicodeLetters is the selectable Go entry and owns its fixture variants and local closures. It invokes markdownSlug in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestMarkdownGeneratedAnchorsPreserveUnicodeLetters(t *testing.T) {
  cases := map[string]string{
    "주문 생성 정책":          "주문-생성-정책",
    "Résumé / Café":     "résumé-café",
    "Create---  Order!": "create-order",
    "snake_case value":  "snake_case-value",
  }
  for heading, expected := range cases {
    if actual := markdownSlug(heading); actual != expected {
      t.Errorf("markdownSlug(%q) = %q, want %q", heading, actual, expected)
    }
  }
}
