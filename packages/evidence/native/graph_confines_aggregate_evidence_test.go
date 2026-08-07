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

/**
 * Verifies a tag on an ineligible host keeps the diagnostic that can be acted on.
 *
 * The confinement check has to run behind every other gate. A tag on a host the claim does not select is already wrong for a reason this one would mask, and the repair it offers cannot be taken there: citing the units the host delivers still leaves the host unselected, so an author who follows the sentence lands on a different error.
 *
 *  1. Confine coverage on a claim selecting functions, and keep it active with one.
 *  2. Cite a containing scope from an interface, which the claim does not select.
 *  3. Assert the out-of-scope host is named and the confinement finding stays away.
 */
func TestConfinedCoverageYieldsToTheHostDiagnostic(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/ok.ts": `/** @evidence docs/spec.md#sign-in Implements sign-in. */
export function testSignIn(): void {}
`,
    "src/bad.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export interface IAuthentication {}
`,
  }, aggregateConfig)
  assertProblemContains(t, messages, "Out-of-scope @evidence host at src/bad.ts:1")
  assertProblemContains(t, messages, "host kind 'type' is not selected")
  if countProblemsContaining(messages, "Aggregate @evidence") != 0 {
    t.Fatalf(
      "the confinement finding masked the reason the tag is actually wrong:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies an owed unit says why an ancestor citation will not answer for it.
 *
 * This is the sentence an author reads on every unit the option newly leaves owed, and the only place the rule explains itself to someone who has not read the configuration. Without it the repair reads as ordinary missing coverage, and the tag they already wrote above the file looks like it should have counted.
 *
 *  1. Confine coverage and cite the containing scope.
 *  2. Read the diagnostic of a unit that is now uncovered.
 *  3. Assert it names the option and what it requires.
 */
func TestConfinedCoverageExplainsItselfOnTheOwedUnit(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export function testAuthentication(): void {}
`,
  }, aggregateConfig)
  assertProblemContains(t, messages, "noAggregateEvidence is set here, so this unit needs its own name")
  assertProblemContains(t, messages, "a positive citation of a scope containing it will not answer for it")
}

/**
 * Verifies the narrowed set is what uniqueEvidence counts and what pairs a conflict.
 *
 * Both read coverage through the same set, and both fail by falling silent: a parent and a child cited by different hosts stop being two hosts on one unit, and an exclusion under a cited parent stops being a conflict. A regression in either direction removes a diagnostic rather than adding one, which no assertion on a clean graph would notice.
 *
 *  1. Cite the parent from one host and the child from another under uniqueEvidence.
 *  2. Cite the parent and exclude the child.
 *  3. Assert each reports while the cascade is on and neither does once it is off.
 */
func TestConfinedCoverageDecidesHostsAndConflicts(t *testing.T) {
  const document = "## Posts {#posts}\n\n### Create A Post {#create-a-post}\n"
  configure := func(policy string) string {
    return `{"claims":[{
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2","h3"]` + policy + `
      }
    }]}`
  }
  hosts := map[string]string{
    "docs/spec.md": document,
    "src/post.ts": `/** @evidence docs/spec.md#posts Renders the post surface. */
export function testPosts(): void {}
`,
    "src/feed.ts": `/** @evidence docs/spec.md#create-a-post Creates a post. */
export function testCreate(): void {}
`,
  }
  cascading := runIndexRule(t, hosts, configure(`,"uniqueEvidence":true`))
  assertProblemContains(t, cascading, "has 2 distinct positive evidence host(s)")
  confined := runIndexRule(t, hosts, configure(`,"uniqueEvidence":true,"noAggregateEvidence":true`))
  if len(confined) != 0 {
    t.Fatalf(
      "a confined citation still counted as a host on the child:\n%s",
      strings.Join(confined, "\n"),
    )
  }

  conflicting := map[string]string{
    "docs/spec.md": document,
    "src/post.ts": `/** @evidence docs/spec.md#posts Renders the post surface. */
export function testPosts(): void {}

/** @evidenceExclude docs/spec.md#create-a-post The composer owns creation; false once this page composes. */
export function testCreation(): void {}
`,
  }
  paired := runIndexRule(t, conflicting, configure(""))
  assertProblemContains(t, paired, "Conflicting acknowledgements for 'docs/spec.md#create-a-post'")
  separated := runIndexRule(t, conflicting, configure(`,"noAggregateEvidence":true`))
  if len(separated) != 0 {
    t.Fatalf(
      "a confined citation still conflicted with an exclusion below it:\n%s",
      strings.Join(separated, "\n"),
    )
  }
}

/**
 * Verifies confinement reaches a TypeScript population, not only a Markdown one.
 *
 * The option reads coverage from the resolved scope map, which every artifact kind shares, so a Markdown-only proof leaves that shared path asserted for one caller. An interface citing its own properties is the shape a TypeScript reference actually meets.
 *
 *  1. Select properties and cite the interface that contains them.
 *  2. Confine coverage on that reference.
 *  3. Assert each property is owed by its own name and the citation reports.
 */
func TestConfinedCoverageReachesTypeScriptUnits(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contract.ts": `export interface ISale {
  id: string;
  price: number;
}
`,
    "src/test.ts": `import type { ISale } from "./contract";

/** @evidence {@link ISale} Mirrors the sale contract. */
export function testSale(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/test.ts"],
    "symbol":"function",
    "reference":{
      "type":"typescript",
      "files":["src/contract.ts"],
      "symbol":["property"],
      "noAggregateEvidence":true
    }
  }]}`)
  assertProblemContains(t, messages, "Aggregate @evidence at src/test.ts:3")
  for _, target := range []string{"ISale.id", "ISale.price"} {
    assertProblemContains(t, messages, "Missing acknowledgement for '"+target+"'")
  }
}

/**
 * Verifies the two refusals compose into the obligation the issue is about.
 *
 * `noEvidenceExclude` closes the front door and aggregate scope was the side door, so a reference wanting delivery named unit by unit and no excuses declares both. If either half quietly disarmed the other, the configuration that motivated the option would be the one configuration it fails at.
 *
 *  1. Declare both refusals on one reference.
 *  2. Answer one unit with an exclusion and the rest with an ancestor citation.
 *  3. Assert the exclusion is forbidden and every unit still owes its own name.
 */
func TestConfinedCoverageComposesWithRefusedExclusions(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export function testAuthentication(): void {}

/** @evidenceExclude docs/spec.md#sign-out The gateway owns sign-out; false once a screen must. */
export function testSignOut(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2"],
      "noEvidenceExclude":true,
      "noAggregateEvidence":true
    }
  }]}`)
  assertProblemContains(t, messages, "Forbidden @evidenceExclude for 'docs/spec.md#sign-out'")
  assertProblemContains(t, messages, "Aggregate @evidence at src/test.ts:1")
  assertProblemContains(t, messages, "this reference forbids @evidenceExclude")
  for _, target := range []string{"docs/spec.md#sign-in", "docs/spec.md#sign-out"} {
    assertProblemContains(t, messages, "Missing acknowledgement for '"+target+"'")
  }
}

/**
 * Verifies a reference declaring two refusals says both of them.
 *
 * Each option narrows a different way, so the repair has to compose rather than choose. Writing one sentence over the other left a reference that refuses exclusions saying nothing about exclusions, which is the sentence its author most needs: they would try the one answer the reference will never take.
 *
 *  1. Require a relation and refuse exclusions and aggregate coverage on one reference.
 *  2. Leave the unit uncovered.
 *  3. Assert the repair names all three constraints.
 */
func TestRepairComposesEveryRefusalTheReferenceDeclares(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidence docs/spec.md#sign-in Implements sign-in. */
export function testSignIn(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2"],
      "role":"implements",
      "noEvidenceExclude":true,
      "noAggregateEvidence":true
    }
  }]}`)
  assertProblemContains(t, messages, "Use @evidence(implements) on a selected typescript host; this reference forbids @evidenceExclude.")
  assertProblemContains(t, messages, "discharged only by positive evidence naming the 'implements' relation")
  assertProblemContains(t, messages, "noAggregateEvidence is set here")
  if countProblemsContaining(messages, "still answers for it") != 0 {
    t.Fatalf(
      "a reference refusing exclusions offered one as an answer:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a declaration refused two different ways hears both reasons at once.
 *
 * The two refusals are independent, so one tag can be wrong for a relation in one obligation and wrong for its scope in another. Reporting only the first costs the author a whole build cycle: they name the relation, re-run, and only then learn the target was never the right one. It also makes the relation sentence false, because the obligation it did not mention wanted a named unit rather than another relation.
 *
 *  1. Require a relation in one claim and confine coverage in another.
 *  2. Cite an aggregate scope once, naming no relation.
 *  3. Assert both findings report at the tag.
 */
func TestBothRefusalsReportForOneDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export function testAuthentication(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2"],
        "role":"implements"
      }
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2"],
        "noAggregateEvidence":true
      }
    }
  ]}`)
  assertProblemContains(t, messages, "Unwanted relation on @evidence at src/test.ts:1")
  assertProblemContains(t, messages, "Aggregate @evidence at src/test.ts:1")
}

/**
 * Verifies a confined citation that answered elsewhere is not reported.
 *
 * The silence is what makes the finding trustworthy, and it is shared with the relation refusal through one gate that only the relation twin covers. A tag discharging a reference that accepts aggregate scope is correct; reporting it because a stricter reference beside it refused would make the finding fire on tags nobody should change.
 *
 *  1. Select one target through a confining reference and an ordinary one.
 *  2. Cite the containing scope once from a host both claims select.
 *  3. Assert the ordinary obligation is discharged and the tag is never reported.
 */
func TestConfinedRefusalIsSilentWhenTheTagAnsweredElsewhere(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export function testAuthentication(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2"],
        "noAggregateEvidence":true
      }
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2"]
      }
    }
  ]}`)
  if countProblemsContaining(messages, "Aggregate @evidence") != 0 {
    t.Fatalf(
      "a citation that answered an obligation was reported anyway:\n%s",
      strings.Join(messages, "\n"),
    )
  }
  if countProblemsContaining(messages, "Non-participating") != 0 {
    t.Fatalf(
      "a participating declaration was reported as participating in nothing:\n%s",
      strings.Join(messages, "\n"),
    )
  }
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 2 {
    t.Fatalf(
      "expected only the confining claim's two units to stay owed, got %d:\n%s",
      count,
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a cardinality count says the citation it would not take.
 *
 * A host that cited an ancestor and hears "cites 0" is told its one visible tag is not there. That is the same hazard a required relation already explains itself out of, and it is sharper here: the tag can be silent at its own location, because another obligation took it.
 *
 *  1. Confine coverage and count one unit per host on one reference.
 *  2. Let an ordinary reference beside it accept the same ancestor citation.
 *  3. Assert the count names what it counted.
 */
func TestConfinedCardinalityNamesWhatItCounted(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidence docs/spec.md#authentication Implements authentication. */
export function testAuthentication(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2"],
        "noAggregateEvidence":true,
        "singleEvidencePerSymbol":true
      }
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2"]
      }
    }
  ]}`)
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s) cited by their own names")
  if countProblemsContaining(messages, "Aggregate @evidence") != 0 {
    t.Fatalf(
      "the tag answered another obligation and should stay silent:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies every diagnostic that prescribes a citation prescribes one the reference takes.
 *
 * Four sites tell an author how to write an acknowledgement, and for three of them the grammar was spelled at the call site. Each option that changes what a citation must look like therefore reached the one site that composes its text and left the others prescribing something the same reference refuses, in the same build. This case holds the three sites that spelled it, so a change to any one of them has to keep agreeing with the reference it speaks for. It cannot stop a new site from spelling its own, which is what the two helpers and this note are for.
 *
 *  1. Refuse an exclusion on a reference that also requires a relation and confines coverage.
 *  2. Write a malformed tag and an unbraced symbol target, each carrying a relation.
 *  3. Assert every prescription names the relation, and that the exclusion repair says the scope is not one this reference takes.
 */
func TestEveryPrescriptionMatchesTheReferenceItSpeaksFor(t *testing.T) {
  forbidden := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidenceExclude docs/spec.md#authentication The gateway owns it; false once a screen must. */
export function testAuthentication(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2"],
      "role":"implements",
      "noEvidenceExclude":true,
      "noAggregateEvidence":true
    }
  }]}`)
  assertProblemContains(t, forbidden, "Remove the exclusion and cite the target with '@evidence(implements)'")
  assertProblemContains(t, forbidden, "so cite 'docs/spec.md#sign-in', 'docs/spec.md#sign-out' instead")

  malformed := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence(implements) */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"implements"
    }
  }]}`)
  assertProblemContains(t, malformed, "Write '@evidence(implements) <target> <reason>'")

  unbraced := runIndexRule(t, map[string]string{
    "src/contract.ts": "export interface IContract {}\n",
    "src/test.ts": `import type { IContract } from "./contract";

void (null as unknown as IContract);

/** @evidence(implements) IContract Implements the contract. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/test.ts"],
    "symbol":"function",
    "reference":{
      "type":"typescript",
      "files":["src/contract.ts"],
      "symbol":"type",
      "role":"implements"
    }
  }]}`)
  assertProblemContains(t, unbraced, "Write '@evidence(implements) {@link IContract} <reason>'")
}

/**
 * Verifies one reference refusing a tag two ways says both at once.
 *
 * A reference may require a relation and confine coverage together, and a tag can be wrong for both. Reporting whichever gate came first costs the author a whole build: they name the relation, re-run, and only then learn the target was never one this reference takes. The cross-claim shape of this was already closed; this is the same cost from a single reference.
 *
 *  1. Declare both refusals on one reference.
 *  2. Cite an aggregate scope naming no relation.
 *  3. Assert both findings report at the tag.
 */
func TestOneReferenceRefusingTwoWaysSaysBoth(t *testing.T) {
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
      "symbol":["h2"],
      "role":"implements",
      "noAggregateEvidence":true
    }
  }]}`)
  assertProblemContains(t, messages, "Unwanted relation on @evidence at src/test.ts:1")
  assertProblemContains(t, messages, "Aggregate @evidence at src/test.ts:1")
}

/**
 * Verifies a repair says nothing about confinement when the target is already a unit.
 *
 * A confining reference still takes a citation of a selected unit, so a caveat keyed on the option rather than on the target tells an author naming one to name something else. That sends them to change what was already right, which is worse than saying nothing.
 *
 *  1. Refuse exclusions and confine coverage on one reference.
 *  2. Exclude a selected unit rather than a scope containing them.
 *  3. Assert the repair names the citation and adds no confinement sentence.
 */
func TestConfinementCaveatFollowsTheTargetNotThePolicy(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": aggregateDocument,
    "src/test.ts": `/** @evidenceExclude docs/spec.md#sign-in The gateway owns it; false once a screen must. */
export function testSignIn(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2"],
      "noEvidenceExclude":true,
      "noAggregateEvidence":true
    }
  }]}`)
  assertProblemContains(t, messages, "Remove the exclusion and cite the target with '@evidence'")
  if countProblemsContaining(messages, "noAggregateEvidence refuses a positive citation") != 0 {
    t.Fatalf(
      "a target that is itself a unit was told to name something else:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a repair before resolution prescribes the relation the obligations agree on.
 *
 * A malformed or unbraced tag is repaired before any reference has resolved it, so the call site once spelled the grammar itself and told the author to write a citation the only obligation refuses. Echoing what they typed is right only when the obligations disagree; when every one wants the same relation there is a right answer, and their own word may be the wrong one.
 *
 *  1. Give one claim a reference requiring a relation, and write a tag naming another.
 *  2. Read the repair, which runs before resolution.
 *  3. Assert it prescribes the relation the obligation wants, then that two obligations wanting different relations fall back to echoing.
 */
func TestRepairBeforeResolutionPrescribesTheAgreedRelation(t *testing.T) {
  agreed := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence(mirrors) */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "role":"implements"
    }
  }]}`)
  assertProblemContains(t, agreed, "Write '@evidence(implements) <target> <reason>'")

  divided := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence(mirrors) */
export function testContract(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "role":"implements"
      }
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "role":"produces"
      }
    }
  ]}`)
  assertProblemContains(t, divided, "Write '@evidence(mirrors) <target> <reason>'")
}
