package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies two tags on one declaration produce one finding per tag.
 *
 * Each '@todo' names one distinct debt, so folding them into one finding would
 * let realizing half the contract clear the whole ledger — the report has to
 * shrink one line per realized promise, not vanish on the first.
 *
 *  1. Stack two '@todo' tags in one block.
 *  2. Run the rule.
 *  3. Assert two findings, each carrying its own text.
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks two todo lines in one block; total count two and both independent debt strings are required.
 * @evidence contracts/testing.md#independent-expectations Each todo is a distinct promise and must produce its own finding.
 * @evidence contracts/testing.md#distinguishing-cases Two debts on one declaration detect per-node collapse or duplicate reporting while preserving each text.
 * @evidence contracts/testing.md#execution-ownership TestTodoReportsEachTagSeparately is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoReportsEachTagSeparately(t *testing.T) {
  messages := runTodoRule(t, "src/persist.ts", `
/**
 * @todo wire the persistence layer
 * @todo emit the audit event
 */
export function persist(value: string): string {
  return value;
}
`)
  if len(messages) != 2 {
    t.Fatalf("expected two findings, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertReportedAmong(t, messages, "'wire the persistence layer'")
  assertReportedAmong(t, messages, "'emit the audit event'")
}
