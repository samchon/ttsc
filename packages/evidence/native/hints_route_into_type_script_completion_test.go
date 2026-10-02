package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the inline-link entry is offered, unclosed, and first.
 *
 * We cannot narrow TypeScript's completion list — the host merges into the
 * upstream response and never removes from it — so routing the author into it
 * is the only move left. The unclosed form is what makes the routing work: the
 * cursor lands where the language service fires, because `Insert` is verbatim
 * and has no snippet expansion to place it anywhere else.
 *
 *  1. Satisfy a graph whose claim cites a TypeScript reference.
 *  2. Take the published corpus.
 *  3. Assert the entry leads, and inserts `{@link ` with its trailing space.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints returns citation hints whose first insert is exactly the unclosed {@link opener with its trailing space and contains no closing brace.
 * @evidence contracts/testing.md#independent-expectations The insert contract leaves the cursor inside inline-link grammar. The literal {@link space expectation is independently authored and detects a closed or reordered opener.
 * @evidence contracts/testing.md#distinguishing-cases A satisfied TypeScript reference with an imported ISale enables the route. This unit checks published insertion text and ranking, without asserting an actual editor completion response.
 * @evidence contracts/testing.md#execution-ownership TestHintsRouteIntoTypeScriptCompletion is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsRouteIntoTypeScriptCompletion(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "src/ledger.ts": hintsSatisfiedLedger,
    "src/sale.ts":   "export interface ISale {\n  price: number;\n}\n",
  }, hintsTypeScriptConfig)
  assertSilent(t, messages)
  cited := targetHintsAt(hints, "@evidence ")
  if len(cited) == 0 {
    t.Fatal("expected a corpus at the citation trigger")
  }
  if cited[0].Insert != "{@link " {
    t.Fatalf("expected the unclosed inline-link opener first, got %q", cited[0].Insert)
  }
  if strings.Contains(cited[0].Insert, "}") {
    t.Fatalf("a closed form parks the cursor past the completion, got %q", cited[0].Insert)
  }
}
