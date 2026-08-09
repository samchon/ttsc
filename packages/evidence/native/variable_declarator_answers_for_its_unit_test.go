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
 * The graph-level half of the case above: a declarator that reads its own
 * withdrawal tag registers no host at all, so the citation on it has nowhere to
 * live. The heading is asserted unacknowledged beside the refusal, because a
 * refusal alone would also be produced by a claim that never ran.
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

// mergedWithdrawnVariable is one identity withdrawn in one declaration and
// spelled again, untagged, in another.
//
// This is the shape the host set and the unit set genuinely disagree about. The
// second declarator carries no tag of its own, so it registers a host, while
// the identity it names came out withdrawn from the first declaration. Only the
// reconciliation over finished identities can take that position away, and only
// if the declarator is among the nodes the unit recorded.
const mergedWithdrawnVariable = `
export namespace N {
  /**
   * @internal
   */
  export var price: number;
}
export namespace N {
  export var other: number,
    /** %s docs/spec.md#pricing A withdrawn identity must not answer here. */
    price: number;
}
`

/**
 * Verifies a withdrawn identity hosts nothing on its other declaration.
 *
 * The sharpest form of the asymmetry, and the one the issue leads with. A
 * declarator that carries no tag of its own registers a host, so an identity
 * withdrawn by a sibling declaration kept a live position, and a declaration
 * the author had taken out of the API went on discharging coverage with no
 * diagnostic anywhere. Reaching it needs the reconciliation over finished
 * identities, which walks a unit's nodes, so the position had to be one of
 * them.
 *
 *  1. Withdraw a namespace variable in one declaration of a merge.
 *  2. Cite a section from the same identity's untagged declarator in the other.
 *  3. Assert the host is refused and the section stays owed.
 */
func TestWithdrawnIdentityHostsNothingOnItsOtherDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Pricing {#pricing}\n",
    "src/contracts.ts": strings.Replace(mergedWithdrawnVariable, "%s", "@evidence", 1),
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
 * Verifies the same position is not an exclusion carrier either.
 *
 * Carrier eligibility reads the same host set through a wider door, so a leak
 * there is a second way for a withdrawn declaration to settle an obligation,
 * and the worse of the two: the reason field makes it read as a reviewed
 * decision rather than a citation.
 *
 *  1. Exclude the same section from the same untagged declarator.
 *  2. Evaluate the same claim.
 *  3. Assert the carrier is refused and the section stays owed.
 */
func TestWithdrawnIdentityIsNotAnExclusionCarrierOnItsOtherDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Pricing {#pricing}\n",
    "src/contracts.ts": strings.Replace(mergedWithdrawnVariable, "%s", "@evidenceExclude", 1),
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "not an eligible exclusion carrier")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}

/**
 * Verifies the same position answers normally when nothing withdrew it.
 *
 * The negative twin of the two cases above. Both of them assert a refusal, and a
 * refusal is also what an over-applied withdrawal produces, so without this the
 * pair would keep passing if every merged identity started coming out withdrawn.
 * The fixture is the same merge with the `@internal` block removed and nothing
 * else changed.
 *
 *  1. Declare the same merged identity with neither half withdrawn.
 *  2. Cite a section from the same untagged declarator.
 *  3. Assert the citation is accepted and the section is discharged.
 */
func TestLiveIdentityAnswersOnItsOtherDeclaration(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": `
export namespace N {
  export var price: number;
}
export namespace N {
  export var other: number,
    /** @evidence docs/spec.md#pricing A live identity answers here. */
    price: number;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`))
}
