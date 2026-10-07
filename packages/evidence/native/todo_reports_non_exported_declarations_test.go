package evidence

import (
  "testing"
)

/**
 * Verifies a non-exported declaration is reported too.
 *
 * The rule has no selection: a debt on a local helper is as unrealized as one
 * on an export, and exempting private code would make "private" the place
 * unrealized contracts go to hide.
 *
 *  1. Put a '@todo' on a local helper beside a realized export.
 *  2. Run the rule.
 *  3. Assert one finding carrying the helper's tag text.
 *
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks a local normalize todo beside a realized exported persist; assertReported requires one local debt finding.
 * @evidence contracts/testing.md#independent-expectations Todo scans the file's declarations without limiting debt to exported public identities.
 * @evidence contracts/testing.md#distinguishing-cases The private helper is the only debt; the clean export prevents confusing this scope with public-only evidence collection.
 * @evidence contracts/testing.md#execution-ownership TestTodoReportsNonExportedDeclarations is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoReportsNonExportedDeclarations(t *testing.T) {
  messages := runTodoRule(t, "src/persist.ts", `
/** @todo tune the cache size */
function normalize(value: string): string {
  return value.trim();
}
/** Persists a normalized value. */
export function persist(value: string): string {
  return normalize(value);
}
`)
  assertReported(t, messages, "Unrealized '@todo': 'tune the cache size'")
}
