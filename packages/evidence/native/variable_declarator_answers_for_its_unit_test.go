package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies an inner declarator's own withdrawal tag withdraws its identity
 * alone.
 *
 * A variable statement's withdrawal used to be taken from the statement
 * wrapper and applied to every declarator it holds, so `@internal` written on
 * one of them withdrew nothing at all. The public sibling is the negative twin
 * that keeps this from reading as "the statement withdrew", which is the answer
 * the old code would have given for a tag one line higher.
 *
 *  1. Withdraw one declarator of a two-declarator statement.
 *  2. Collect the inventory.
 *  3. Assert only that identity carries the tag.
 */
func TestInnerDeclaratorWithdrawsItsOwnIdentity(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export const live = 1,
  /**
   * @internal
   */
  gone = 2;
`)
  rows := []string{}
  for _, unit := range inventory.Units {
    rows = append(rows, unit.Symbol+":"+unit.Target+" hidden="+unit.Hidden)
  }
  sort.Strings(rows)
  want := []string{
    "property:gone hidden=@internal",
    "property:live hidden=",
  }
  if strings.Join(rows, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "declarator withdrawal:\n%s\nwant:\n%s",
      strings.Join(rows, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a withdrawn declarator is not a claim host.
 *
 * The declarator is a host position that no unit recorded, so the reconciliation
 * that takes a withdrawn identity's positions away could not reach it and a
 * declaration the author had removed from the API went on discharging coverage.
 * The heading is asserted unacknowledged beside the refusal, because a refusal
 * alone would also be produced by a claim that never ran.
 *
 *  1. Cite a Markdown section from a withdrawn declarator.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestWithdrawnDeclaratorIsNotAClaimHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": `
export const live = 1,
  /**
   * @internal
   * @evidence docs/spec.md#pricing A withdrawn declarator carries nothing.
   */
  gone = 2;
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}

/**
 * Verifies a citation on an inner declarator counts for that declarator's unit.
 *
 * `singleEvidencePerSymbol` counts distinct units per semantic host, and a
 * citation whose position belongs to no unit resolves to no host, so both
 * identities of the statement were reported as citing zero while the same run
 * reported the obligation satisfied. Recording the declarator is what gives the
 * tag a host to be counted against.
 *
 * The untagged sibling is the control: it must still be reported as citing
 * zero, or the case would pass equally if the policy had stopped counting hosts
 * at all.
 *
 *  1. Cite a section from the second declarator of a two-declarator statement.
 *  2. Evaluate a `singleEvidencePerSymbol` reference over it.
 *  3. Assert only the untagged sibling is reported.
 */
func TestInnerDeclaratorCitationCountsForItsOwnUnit(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": `
export const alpha = 1,
  /** @evidence docs/spec.md#pricing The inner declarator cites this. */
  beta = 2;
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{
      "type":"markdown","files":["docs/**/*.md"],"symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertReported(t, messages, "'alpha' at src/contracts.ts:2")
}
