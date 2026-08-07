package evidence

import (
  "strings"
  "testing"
)

const aggregateDocument = `# Authentication {#authentication}

## Sign In {#sign-in}

## Sign Out {#sign-out}
`

const aggregateConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"function",
  "reference":{
    "type":"markdown",
    "files":["docs/spec.md"],
    "symbol":["h2"],
    "noAggregateEvidence":true
  }
}]}`

/**
 * Verifies a citation of an unselected ancestor answers for nothing and says so at the tag.
 *
 * This is the shape the issue found first: one tag naming the H1 of a document discharged all fourteen of its selected headings, and the requirement nobody implemented was indistinguishable from the ones somebody did. Reporting it at the reference instead would name the units the tag failed to cover and never the tag, which is the one thing an author can act on.
 *
 *  1. Confine coverage to the named unit on a reference selecting H2 only.
 *  2. Cite the containing H1 from a selected host.
 *  3. Assert both H2 units stay owed and the tag reports where it is written.
 */
func TestUnselectedAncestorCitationAnswersForNothing(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export function testAuthentication(): void {}
`,
  }, aggregateConfig)
  assertProblemContains(t, messages, "Aggregate @evidence at src/test.ts:1")
  assertProblemContains(t, messages, "noAggregateEvidence answers each selected unit by its own name")
  for _, target := range []string{"docs/spec.md#sign-in", "docs/spec.md#sign-out"} {
    assertProblemContains(t, messages, "Missing acknowledgement for '"+target+"'")
  }
  if countProblemsContaining(messages, "Non-participating") != 0 {
    t.Fatalf(
      "the refusal must replace the non-participation finding, not join it:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a citation of a selected ancestor covers itself and leaves its descendants owed.
 *
 * The sharper reported shape: a page cited a selected H2 whose subtree includes an operation another page performs. Refusing the citation outright would be wrong, because the host does deliver the section it named; what it does not deliver is everything underneath.
 *
 *  1. Select both heading levels so the cited scope is itself a unit.
 *  2. Cite the parent from a selected host.
 *  3. Assert the parent is covered, the child is not, and no tag is reported.
 */
func TestSelectedAncestorCitationCoversOnlyItself(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Posts {#posts}\n\n### Create A Post {#create-a-post}\n",
    "src/test.ts": `/** @evidence docs/spec.md#posts Renders the post surface. */
export function testPosts(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2","h3"],
      "noAggregateEvidence":true
    }
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#create-a-post'")
  if countProblemsContaining(messages, "docs/spec.md#posts") != 0 {
    t.Fatalf(
      "the named unit must be covered by its own citation:\n%s",
      strings.Join(messages, "\n"),
    )
  }
  if countProblemsContaining(messages, "Aggregate @evidence") != 0 {
    t.Fatalf(
      "a citation that covered its named unit answered for something:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies an exclusion still answers for a whole subtree.
 *
 * The option constrains positive evidence, for the reason a required relation does. One reviewed non-applicability decision per subtree is what an exclusion is, and `noEvidenceExclude` is the option that refuses one; narrowing exclusions here would make a reference that wants named delivery also demand one written decision per heading, which no configuration asked for.
 *
 *  1. Confine coverage to the named unit.
 *  2. Exclude the containing H1 from an eligible carrier.
 *  3. Assert the graph reports nothing.
 */
func TestConfinedCoverageLeavesExclusionScopeWhole(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidenceExclude docs/spec.md#authentication The gateway owns authentication; false once a screen must. */
export function testAuthentication(): void {}
`,
  }, aggregateConfig)
  if len(messages) != 0 {
    t.Fatalf("expected a clean graph, got:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a confined citation counts as the one unit it names.
 *
 * `singleEvidencePerSymbol` counts an aggregate target as every selected descendant in its scope, so a host citing a parent of two units fails it. Once coverage is the named unit alone, that same host cites one, and the two options have to agree or a reference declaring both is unsatisfiable by construction.
 *
 *  1. Declare both options on one reference selecting both heading levels.
 *  2. Cite the parent from one host and the child from another.
 *  3. Assert neither host fails cardinality.
 */
func TestConfinedCoverageCountsAsOneUnitPerHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Posts {#posts}\n\n### Create A Post {#create-a-post}\n",
    "src/feed.ts": `/** @evidence docs/spec.md#create-a-post Creates a post. */
export function testCreate(): void {}
`,
    "src/post.ts": `/** @evidence docs/spec.md#posts Renders the post surface. */
export function testPosts(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2","h3"],
      "noAggregateEvidence":true,
      "singleEvidencePerSymbol":true
    }
  }]}`)
  if len(messages) != 0 {
    t.Fatalf("expected a clean graph, got:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies the option's zero value leaves the cascade exactly as it was.
 *
 * The property is published on a released package, so a reference written before it existed has to decode into the reference it always was. An ancestor citation discharging its selected subtree is the behavior every existing consumer's tags were written against.
 *
 *  1. Run the same document and citation with the option omitted, then with it false.
 *  2. Assert both graphs are clean.
 */
func TestAggregateCoverageSurvivesTheZeroValue(t *testing.T) {
  for _, declared := range []string{"", `,"noAggregateEvidence":false`} {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": aggregateDocument,
      "src/test.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export function testAuthentication(): void {}
`,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2"]`+declared+`
      }
    }]}`)
    if len(messages) != 0 {
      t.Fatalf(
        "the zero value changed the cascade (declared %q):\n%s",
        declared,
        strings.Join(messages, "\n"),
      )
    }
  }
}
