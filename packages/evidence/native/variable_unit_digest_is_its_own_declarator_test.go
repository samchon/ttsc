package evidence

import (
  "testing"
)

// variableDigestOf reports one variable unit's digest from a single file.
func variableDigestOf(t *testing.T, target string, content string) string {
  t.Helper()
  inventory := parseTypeScriptInventory(t, "src/rates.ts", content)
  for _, unit := range inventory.Units {
    if unit.Target == target {
      return unit.Digest
    }
  }
  t.Fatalf("expected a unit for %s in:\n%s", target, content)
  return ""
}

/**
 * Verifies rewording an inner declarator's own block expires nothing.
 *
 * A digest excludes every position a tag can occupy, and this position was the
 * exception. A variable unit is created from its binding identifier, whose span
 * starts where the previous token ended and therefore arrives carrying the
 * block above it — while an identifier reports no documentation of its own, so
 * the exclusion had no span to cut. The declarator does report it, and taking
 * the identity's content from the declarator is what puts the block back inside
 * the exclusion.
 *
 * The initializer edit is the negative twin. Excluding too much would also
 * leave the digest unmoved, and a fingerprint that never moves expires nothing
 * at all.
 *
 *  1. Digest an inner declarator that carries a documentation block.
 *  2. Reword only that block.
 *  3. Assert the digest is unmoved, then assert its initializer still moves it.
 */
func TestRewordingAnInnerDeclaratorBlockExpiresNothing(t *testing.T) {
  first := variableDigestOf(t, "beta", `export const alpha = 1,
  /** First wording. */
  beta = 2;
`)
  reworded := variableDigestOf(t, "beta", `export const alpha = 1,
  /** Second wording, longer and entirely different. */
  beta = 2;
`)
  if first != reworded {
    t.Fatal("rewording an inner declarator's block moved its digest, so writing a review on one expires it")
  }
  changed := variableDigestOf(t, "beta", `export const alpha = 1,
  /** First wording. */
  beta = 3;
`)
  if changed == first {
    t.Fatal("an initializer change left the digest unmoved, so a real content change expires nothing")
  }
}

/**
 * Verifies a sibling declarator's edit expires nothing.
 *
 * TypeScript attaches a variable's leading documentation to the statement
 * wrapper, so the wrapper is a position the identity owns and every consumer
 * that walks a unit's nodes has to reach it. It is not the identity's content:
 * one wrapper declares every sibling, so taking content from it put each
 * declarator's text inside every other declarator's digest, and an edit to one
 * identity expired a review of another.
 *
 * The own-initializer edit is the negative twin, and it is the one that fails
 * if the repair narrows the content to the binding alone.
 *
 *  1. Digest the first declarator of a two-declarator statement.
 *  2. Change only the second declarator's initializer.
 *  3. Assert the first is unmoved, then assert its own initializer still moves
 *     it.
 */
func TestASiblingDeclaratorEditExpiresNothing(t *testing.T) {
  first := variableDigestOf(t, "alpha", `export const alpha = 1,
  /** First wording. */
  beta = 2;
`)
  sibling := variableDigestOf(t, "alpha", `export const alpha = 1,
  /** First wording. */
  beta = 3;
`)
  if first != sibling {
    t.Fatal("a sibling declarator's initializer moved this identity's digest, so an unrelated edit expires its review")
  }
  own := variableDigestOf(t, "alpha", `export const alpha = 9,
  /** First wording. */
  beta = 2;
`)
  if own == first {
    t.Fatal("this identity's own initializer left its digest unmoved, so a real content change expires nothing")
  }
}

/**
 * Verifies a destructured leaf answers for the declarator it shares.
 *
 * The leaves of one pattern have no separate content: they are named by one
 * declarator and take their values from one initializer, so a change to that
 * initializer is a change to each of them and must expire every review of the
 * set. That is the shape a narrower repair would break, and the reason content
 * is stated per declaration rather than derived by narrowing to the smallest
 * node that spells the name.
 *
 * The block above the pattern is the negative twin: sharing a declarator must
 * not bring a tag position back into the digest by the side door.
 *
 *  1. Digest one leaf of a destructuring pattern.
 *  2. Change the shared initializer, then reword the block above the pattern.
 *  3. Assert the first moved it and the second did not.
 */
func TestADestructuredLeafAnswersForItsSharedDeclarator(t *testing.T) {
  first := variableDigestOf(t, "gamma", `declare const source: { gamma: number; delta: number };
export const {
  gamma,
  delta,
} = source;
`)
  reinitialized := variableDigestOf(t, "gamma", `declare const source: { gamma: number; delta: number };
declare const other: { gamma: number; delta: number };
export const {
  gamma,
  delta,
} = other;
`)
  if reinitialized == first {
    t.Fatal("a destructured leaf ignored its own initializer, so the value it takes can change with nothing expiring")
  }
  documented := variableDigestOf(t, "gamma", `declare const source: { gamma: number; delta: number };
/** A block above the pattern. */
export const {
  gamma,
  delta,
} = source;
`)
  if documented != first {
    t.Fatal("a block above a destructuring pattern moved a leaf's digest, so writing a review there expires it")
  }
}

/**
 * Verifies a single-declarator statement answers as it did before.
 *
 * The ordinary shape is the one every existing fingerprint assertion is written
 * against, and it is the one where the statement wrapper and the declarator
 * differ by only the `export const` prefix. Without this, the two cases above
 * would keep passing if the repair had quietly changed what an ordinary
 * variable's digest covers.
 *
 *  1. Digest a single-declarator statement carrying a block.
 *  2. Reword the block, then change the initializer.
 *  3. Assert the first did not move it and the second did.
 */
func TestASingleDeclaratorStatementAnswersAsBefore(t *testing.T) {
  first := variableDigestOf(t, "limit", `/** First wording. */
export const limit = 1;
`)
  reworded := variableDigestOf(t, "limit", `/** Second wording, longer and entirely different. */
export const limit = 1;
`)
  if first != reworded {
    t.Fatal("rewording a variable's own block moved its digest")
  }
  changed := variableDigestOf(t, "limit", `/** First wording. */
export const limit = 2;
`)
  if changed == first {
    t.Fatal("a variable's initializer left its digest unmoved")
  }
}

// innerDeclaratorReviewConfig cites a variable through a TypeScript reference
// that requires a review, which is the only arrangement where the review and
// the unit it fingerprints can share a file.
const innerDeclaratorReviewConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/claim/**"],
  "symbol":"type",
  "reference":{
    "type":"typescript",
    "files":["src/spec/**"],
    "symbol":"property",
    "requireReview":true
  }
}]}`

// bothSiblingsCited cites each declarator of one statement, so a diagnostic
// naming one of them is a statement about that identity alone.
func bothSiblingsCited(alpha string, beta string) string {
  return `import { alpha, beta } from "../spec/rates";

/**
 * @evidence {@link alpha} Mirrors the published floor.
 * @evidenceReview {@link alpha} #` + alpha + ` The floor matches the published one.
 * @evidence {@link beta} Mirrors the published rate.
 * @evidenceReview {@link beta} #` + beta + ` The rate matches the published one.
 */
export interface IView {
  floor: number;
  rate: number;
}
`
}

// bothSiblingsUncited is the same citation set with the reviews removed, which
// is what makes the graph name the fingerprint it expects for each target.
const bothSiblingsUncited = `import { alpha, beta } from "../spec/rates";

/**
 * @evidence {@link alpha} Mirrors the published floor.
 * @evidence {@link beta} Mirrors the published rate.
 */
export interface IView {
  floor: number;
  rate: number;
}
`

/**
 * Verifies a review of an inner declarator survives a block written on it.
 *
 * The unit-level cases state the rule; this states what an author experiences,
 * through the packaged policy rather than through the collector. Writing a
 * block on the cited declarator is where a review of it belongs, and it
 * expiring that very review is the non-terminating repair loop `requireReview`
 * exists to avoid.
 *
 * Both declarators are cited and reviewed, so the assertion is about the whole
 * statement rather than about one identity with an unacknowledged sibling
 * beside it.
 *
 *  1. Take the fingerprint the graph asks for, for each cited declarator.
 *  2. Add a documentation block on the inner one.
 *  3. Assert the graph stays clean.
 */
func TestAReviewOfAnInnerDeclaratorSurvivesABlockWrittenOnIt(t *testing.T) {
  expected := everyExpectedFingerprint(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 1,
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsUncited,
  }, innerDeclaratorReviewConfig)
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 1,
  /**
   * The published rate.
   */
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsCited(
      expected["{@link alpha}"],
      expected["{@link beta}"],
    ),
  }, innerDeclaratorReviewConfig))
}

/**
 * Verifies an edit expires the review of the identity it changed, and only
 * that one.
 *
 * This is the sharpest form of the sibling rule, and it is a negative twin in
 * both directions at once. A digest that covers the whole statement expires
 * both reviews here, and a digest that covers nothing expires neither; only a
 * digest taken from the edited declarator alone produces exactly one
 * diagnostic. It also keeps the case above from passing on a policy that never
 * expires anything.
 *
 *  1. Take the fingerprint the graph asks for, for each cited declarator.
 *  2. Change the first declarator's initializer and nothing else.
 *  3. Assert exactly one diagnostic, naming that declarator.
 */
func TestAnEditExpiresOnlyTheReviewOfTheIdentityItChanged(t *testing.T) {
  expected := everyExpectedFingerprint(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 1,
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsUncited,
  }, innerDeclaratorReviewConfig)
  assertReported(t, runIndexRule(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 9,
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsCited(
      expected["{@link alpha}"],
      expected["{@link beta}"],
    ),
  }, innerDeclaratorReviewConfig), "Stale @evidenceReview for '{@link alpha}'")
}
