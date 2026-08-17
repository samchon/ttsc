package evidence

import (
  "strings"
  "testing"
)

const checklistDocument = `## No hardcoding {#no-hardcoding}

Fix the general logic instead of special-casing a fixture.

## No whack-a-mole {#no-whack-a-mole}

Seal the class of failure rather than the witness.
`

const checklistConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"function",
  "reference":{
    "type":"markdown",
    "files":["docs/rules.md"],
    "symbol":"h2",
    "checklist":true
  }
}]}`

/**
 * Verifies a checklist owes every item from every selected host.
 *
 * Ordinary coverage is satisfied once per reference, so a thorough host answers for every other host in the claim and a host that answered nothing is invisible. The checklist reference must instead judge each host against the whole population and report only the hosts that fell short.
 *
 *  1. Select two functions and a two-item Markdown checklist.
 *  2. Cite both items from one host and only the first from the other.
 *  3. Assert the complete host passes and the partial host is reported with just its missing item.
 */
func TestChecklistOwesEveryItemFromEveryHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/complete.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 */
export function complete(): void {}
`,
    "src/partial.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function partial(): void {}
`,
  }, checklistConfig)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 1 {
    t.Fatalf("expected only the partial host to be reported, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'partial'")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  if strings.Contains(strings.Join(messages, "\n"), "'complete'") {
    t.Fatalf("a host that answered every item was reported:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a host carrying no tag owes the whole checklist.
 *
 * Counting only the hosts that wrote something would let a file join the claim and answer nothing, which is the silent hole the per-host denominator exists to close. The report must also stay one diagnostic naming both items rather than one per pair.
 *
 *  1. Select a function with no documentation comment beside a two-item checklist.
 *  2. Run the graph.
 *  3. Assert one diagnostic names the host and both unanswered items.
 */
func TestChecklistCountsASilentHostAsOwingEveryItem(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/silent.ts": "export function silent(): void {}\n",
  }, checklistConfig)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 1 {
    t.Fatalf("expected exactly one host diagnostic, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'silent'")
  assertProblemContains(t, messages, "has not acknowledged 2 of 2 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, messages, "Do what each item requires and cite it with @evidence on this host")
}

/**
 * Verifies an exclusion answers a checklist item and obeys the refusing policy.
 *
 * A checklist item that does not apply to a host has one honest answer, and refusing it would leave the author only an untrue citation. The same reference under `noEvidenceExclude` must reverse that and leave the item owed, or the strict spelling would be indistinguishable from the ordinary one.
 *
 *  1. Cite one item and exclude the other from a single host.
 *  2. Assert the host passes.
 *  3. Re-run the same source under `noEvidenceExclude` and assert the exclusion is forbidden and its item still owed.
 */
func TestChecklistAcceptsAnExclusionUnlessTheReferenceRefusesOne(t *testing.T) {
  files := map[string]string{
    "docs/rules.md": checklistDocument,
    "src/mixed.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidenceExclude docs/rules.md#no-whack-a-mole This helper has one case.
 */
export function mixed(): void {}
`,
  }
  assertNoProblems(t, runIndexRule(t, files, checklistConfig))

  strict := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true,
      "noEvidenceExclude":true
    }
  }]}`)
  assertProblemContains(t, strict, "Forbidden @evidenceExclude for 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, strict, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, strict, "this reference forbids @evidenceExclude")
}

/**
 * Verifies a checklist refuses an aggregate citation and keeps the exclusion cascade.
 *
 * The whole point of the option collapses if one file-level citation ticks every box, so a positive target naming a scope that merely contains the items is refused by name. The negative twin matters just as much: "none of this applies here" is one reviewed decision however many items it covers, so the same target must still discharge the host as an exclusion.
 *
 *  1. Cite the containing document from one host under an H2 checklist.
 *  2. Assert the aggregate target is reported and its items are not listed again as missing.
 *  3. Exclude the same document from the same host and assert it passes.
 */
func TestChecklistRefusesAnAggregateCitationButNotAnAggregateExclusion(t *testing.T) {
  aggregate := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/** @evidence docs/rules.md Everything in here is honored. */
export function broad(): void {}
`,
  }, checklistConfig)
  assertProblemContains(t, aggregate, "Aggregate @evidence target 'docs/rules.md'")
  assertProblemContains(t, aggregate, "names a scope containing 2 item(s) ('docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole') rather than one of them")
  assertProblemContains(t, aggregate, "Cite each item this host answers for")
  if count := countProblemsContaining(aggregate, "checklist item(s)"); count != 0 {
    t.Fatalf("the aggregate diagnostic must not be doubled by a per-item missing list, got %d:\n%s", count, strings.Join(aggregate, "\n"))
  }

  excluded := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/** @evidenceExclude docs/rules.md This module is generated. */
export function broad(): void {}
`,
  }, checklistConfig)
  assertNoProblems(t, excluded)
}

/**
 * Verifies a selected item is citable while a partially covering scope is not.
 *
 * The refusal is "this target is not one of the items", never "this target has descendants". A reference selecting both H2 and H3 makes an H2 an item *and* a scope, so citing it must stay legal, while the document that selects neither must stay refused — the boundary the aggregate rule turns on.
 *
 *  1. Select H2 and H3 as checklist items.
 *  2. Cite both from one host and cite the document from another.
 *  3. Assert only the document citation is refused, and the host that named the items directly is silent.
 */
func TestChecklistJudgesAnAggregateBySelectionRatherThanByDescendants(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": `## No hardcoding {#no-hardcoding}

### Fixtures {#fixtures}
`,
    "src/section.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#fixtures No fixture name is special-cased.
 */
export function section(): void {}
`,
    "src/document.ts": `/** @evidence docs/rules.md Everything in here is honored. */
export function document(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":["h2","h3"],
      "checklist":true
    }
  }]}`)
  if count := countProblemsContaining(messages, "Aggregate @evidence target"); count != 1 {
    t.Fatalf("expected only the document citation to be aggregate, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Aggregate @evidence target 'docs/rules.md' at src/document.ts")
  // The H2 is an item and a scope at once here, so a citation of it must not be
  // read as an aggregate of the H3 beneath it.
  if strings.Contains(strings.Join(messages, "\n"), "'section'") {
    t.Fatalf("citing a selected item that also contains one was refused:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a citation answers the item it names and never the items beneath it.
 *
 * Refusing the unselected ancestor is not enough, and only this shape shows it. Under the default Markdown selector the file is itself an item, so one document citation resolves to a selected unit, and if that citation kept the ordinary subtree cascade it would discharge every heading on that host. The option would then be a no-op in the first configuration an adopter writes, with no diagnostic anywhere.
 *
 *  1. Cite the document under the default selector, where the file is an item and the headings are items too.
 *  2. Assert the file item is answered and both headings are still owed.
 *  3. Repeat with an explicit ancestor and descendant selection and assert the descendant survives its parent's citation.
 */
func TestAChecklistCitationAnswersOnlyTheItemItNames(t *testing.T) {
  defaulted := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/** @evidence docs/rules.md This module honors the document itself. */
export function broad(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "checklist":true
    }
  }]}`)
  // The file is a selected item here, so the citation is legal and answers one
  // item. Refusing it as an aggregate would be the opposite error.
  if strings.Contains(strings.Join(defaulted, "\n"), "Aggregate @evidence target") {
    t.Fatalf("a citation of a selected file item was refused as an aggregate:\n%s", strings.Join(defaulted, "\n"))
  }
  assertProblemContains(t, defaulted, "has not acknowledged 2 of 3 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")

  nested := runIndexRule(t, map[string]string{
    "docs/rules.md": `## No hardcoding {#no-hardcoding}

### Fixtures {#fixtures}
`,
    "src/section.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function section(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":["h2","h3"],
      "checklist":true
    }
  }]}`)
  assertProblemContains(t, nested, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#fixtures'")
}

/**
 * Verifies duplicate and conflict detection carries the host under a checklist.
 *
 * Both keys are obligation-wide without this option, so two hosts excluding one item read as a duplicate and one host citing an item another excludes reads as a contradiction. Under a checklist both are the expected state, and the negative twin proves the keys still fire inside one host.
 *
 *  1. Cite an item from one host while two other hosts exclude it.
 *  2. Assert no duplicate or conflict is reported across those hosts.
 *  3. Cite and exclude the same item on one host and assert the conflict returns.
 */
func TestChecklistJudgesDuplicatesAndConflictsPerHost(t *testing.T) {
  document := "## Only rule {#only-rule}\n"
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true
    }
  }]}`
  across := runIndexRule(t, map[string]string{
    "docs/rules.md": document,
    "src/cites.ts": `/** @evidence docs/rules.md#only-rule This module honors it. */
export function cites(): void {}
`,
    "src/first.ts": `/** @evidenceExclude docs/rules.md#only-rule Nothing here applies. */
export function first(): void {}
`,
    "src/second.ts": `/** @evidenceExclude docs/rules.md#only-rule Nothing here applies either. */
export function second(): void {}
`,
  }, config)
  assertNoProblems(t, across)

  within := runIndexRule(t, map[string]string{
    "docs/rules.md": document,
    "src/both.ts": `/**
 * @evidence docs/rules.md#only-rule This module honors it.
 * @evidenceExclude docs/rules.md#only-rule It does not apply.
 */
export function both(): void {}
`,
  }, config)
  assertProblemContains(t, within, "Conflicting acknowledgements for 'docs/rules.md#only-rule'")
}

/**
 * Verifies a claim-level exclusion carrier answers the item for every host.
 *
 * A carrier that is not itself a selected host records that no host owes the item, which is what gathering exclusions into one ledger file is for. Binding such a tag to whichever declaration it sits above would make that ledger unwritable under a checklist, so the decision has to reach every host in the claim.
 *
 *  1. Select functions as hosts and put an exclusion on an exported interface.
 *  2. Add a second host that writes nothing about the excluded item.
 *  3. Assert both hosts are discharged for it and still owe the other item.
 */
func TestChecklistSpreadsAnUnhostedExclusionAcrossEveryHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md#no-whack-a-mole This package has one code path. */
export interface ILedger {
  id: string;
}

/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function first(): void {}
`,
    "src/second.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides here too. */
export function second(): void {}
`,
  }, checklistConfig)
  assertNoProblems(t, messages)
}

/**
 * Verifies exclusion carriers keep their gathering role under a checklist.
 *
 * `evidenceExcludeCarriers` exists so every exclusion a claim owns is read by opening one file, and a checklist is exactly the shape where that matters most, since an item dropped for the whole claim disappears from every host at once. The placement rule must still be judged first, so a tag written outside the carriers is reported rather than quietly spread.
 *
 *  1. Confine the claim's exclusions to one ledger file and drop an item there from a non-host declaration.
 *  2. Assert both hosts are discharged for the dropped item.
 *  3. Move the same tag into an ordinary claim file and assert it is reported as misplaced and discharges nothing.
 */
func TestChecklistReadsAnExclusionLedgerBeforeSpreadingIt(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "evidenceExcludeCarriers":["src/EXCLUSIONS.ts"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true
    }
  }]}`
  worker := `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function worker(): void {}
`
  ledger := `/** @evidenceExclude docs/rules.md#no-whack-a-mole This package has one code path. */
export interface IExclusions {
  reviewed: string;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/rules.md":     checklistDocument,
    "src/EXCLUSIONS.ts": ledger,
    "src/worker.ts":     worker,
    "src/downstream.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides here too. */
export function downstream(): void {}
`,
  }, config))

  misplaced := runIndexRule(t, map[string]string{
    "docs/rules.md":     checklistDocument,
    "src/EXCLUSIONS.ts": "export interface IExclusions {\n  reviewed: string;\n}\n",
    "src/worker.ts":     ledger + worker,
  }, config)
  assertProblemContains(t, misplaced, "Misplaced @evidenceExclude")
  // The title alone would survive a regression that named the wrong target or
  // dropped the carrier globs, and this is the suite's only runtime coverage of
  // the message.
  assertProblemContains(t, misplaced, "target 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, misplaced, "confines this claim's exclusions to")
  assertProblemContains(t, misplaced, "src/EXCLUSIONS.ts")
  assertProblemContains(t, misplaced, "Move the tag there")
  assertProblemContains(t, misplaced, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
}

/**
 * Verifies a checklist constrains only the reference that declares it.
 *
 * Reference-local strengthening is the contract every policy option shares, and a checklist changes more machinery than the others — coverage, aggregates, and the duplicate keys. An ordinary twin over the same document must therefore stay satisfied by one host while the checklist reports the other.
 *
 *  1. Configure an ordinary and a checklist reference over one document.
 *  2. Answer every item from one host only.
 *  3. Assert the ordinary reference is silent and only the checklist reference reports the other host.
 */
func TestChecklistStaysLocalToItsOwnReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/complete.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 */
export function complete(): void {}
`,
    "src/quiet.ts": "export function quiet(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2"
      },
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 1 {
    t.Fatalf("expected exactly one checklist diagnostic, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Claim 1 reference 2")
  assertProblemContains(t, messages, "TypeScript function 'quiet'")
  if strings.Contains(strings.Join(messages, "\n"), "Missing acknowledgement") {
    t.Fatalf("the ordinary reference lost its own coverage answer:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a healthy empty population leaves every checklist host passing.
 *
 * `singleEvidencePerSymbol` keeps judging an empty population because a host still owes the one unit it cannot find. A checklist has no such floor — a host owes each item and there are none — so the same shape must leave the host alone and report only the empty population the materializer already names.
 *
 *  1. Select a document containing no H2 section.
 *  2. Run a checklist reference over it with one selected host.
 *  3. Assert the empty population is the only diagnostic and the host is not judged.
 */
func TestChecklistPassesAgainstAHealthyEmptyPopulation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": "Plain prose with no selected heading.\n",
    "src/quiet.ts":  "export function quiet(): void {}\n",
  }, checklistConfig)
  if len(messages) != 1 {
    t.Fatalf("expected only the empty-population diagnostic, got:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "found no selected evidence units (h2)")
}

/**
 * Verifies a Markdown claim answers a checklist the way a TypeScript claim does.
 *
 * The option is confined to the Markdown reference, never to the claim, and the case it was asked for is a document set answering a rules document. A claim-kind dependency would leave that shape working only for code, and the file-level host is the granularity that makes the document side usable at all.
 *
 *  1. Select whole plan documents as hosts and a two-item rules document as the checklist.
 *  2. Answer both items in one plan and nothing in the other.
 *  3. Assert the answering plan passes and the silent plan owes both items.
 */
func TestChecklistAnswersFromAMarkdownClaim(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "plans/alpha.md": `<!-- @evidence docs/rules.md#no-hardcoding The plan keeps the general path. -->
<!-- @evidence docs/rules.md#no-whack-a-mole The plan seals the class. -->

Alpha plan prose.
`,
    "plans/gamma.md": `<!-- @evidence docs/rules.md#no-hardcoding The plan keeps the general path. -->

Gamma plan prose.
`,
    "plans/beta.md": "Beta plan prose with no acknowledgement.\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["plans/**"],
    "symbol":"file",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true
    }
  }]}`)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 2 {
    t.Fatalf("expected the partial and the silent plan to be reported, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Evidence host Markdown file at plans/beta.md")
  assertProblemContains(t, messages, "has not acknowledged 2 of 2 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, messages, "Evidence host Markdown file at plans/gamma.md")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  // Without the partial plan and this guard, a regression discharging a host on
  // its first acknowledgement would leave the counts unchanged.
  if strings.Contains(strings.Join(messages, "\n"), "plans/alpha.md") {
    t.Fatalf("a plan that answered every item was reported:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a reviewed checklist expires one item's answers and leaves the rest green.
 *
 * Per-item expiry is the property a checklist is documented to buy, and it exists only because the aggregate citation is refused: one document-wide tag would carry one fingerprint for the whole document and every edit would expire everything. Editing one item must therefore reach that item's reviews on every host and no others.
 *
 *  1. Answer a two-item checklist from two hosts, each review carrying the fingerprint the graph asks for.
 *  2. Assert the reviewed checklist passes.
 *  3. Edit the body of one item and assert both hosts go stale on that item alone.
 */
func TestChecklistExpiresReviewsOneItemAtATime(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true,
      "requireReview":true
    }
  }]}`
  build := func(document string, first string, second string) map[string]string {
    return map[string]string{
      "docs/rules.md": document,
      "src/first.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidenceReview docs/rules.md#no-hardcoding ` + first + ` Read the rule against this module.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 * @evidenceReview docs/rules.md#no-whack-a-mole ` + second + ` Read the rule against this module.
 */
export function first(): void {}
`,
      "src/second.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides here too.
 * @evidenceReview docs/rules.md#no-hardcoding ` + first + ` Read the rule against this module.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered here too.
 * @evidenceReview docs/rules.md#no-whack-a-mole ` + second + ` Read the rule against this module.
 */
export function second(): void {}
`,
    }
  }
  expected := everyExpectedFingerprint(t, build(checklistDocument, "", ""), config)
  reviewed := build(
    checklistDocument,
    "#"+expected["docs/rules.md#no-hardcoding"],
    "#"+expected["docs/rules.md#no-whack-a-mole"],
  )
  assertNoProblems(t, runIndexRule(t, reviewed, config))

  edited := strings.Replace(
    checklistDocument,
    "Fix the general logic instead of special-casing a fixture.",
    "Fix the general logic instead of special-casing a fixture or an expected value.",
    1,
  )
  if edited == checklistDocument {
    t.Fatal("the edit did not reach the first item's body")
  }
  reviewed["docs/rules.md"] = edited
  stale := runIndexRule(t, reviewed, config)
  if count := countProblemsContaining(stale, "Stale @evidenceReview"); count != 2 {
    t.Fatalf("expected both hosts to expire on the edited item, got %d:\n%s", count, strings.Join(stale, "\n"))
  }
  if strings.Contains(strings.Join(stale, "\n"), "no-whack-a-mole") {
    t.Fatalf("an untouched item expired with its sibling:\n%s", strings.Join(stale, "\n"))
  }

  // Everything above still passes with `checklist` deleted, because a
  // fingerprint belongs to the cited address and two targets always expire
  // separately. What the option contributes is that the one-tag shortcut below
  // is no longer available, so the two arms are asserted against each other.
  document := map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/**
 * @evidence docs/rules.md Everything in here is honored.
 * @evidenceReview docs/rules.md #0000000000000000 Read the whole document.
 */
export function broad(): void {}
`,
  }
  ordinary := strings.Replace(config, `"checklist":true,`, "", 1)
  if ordinary == config {
    t.Fatal("the ordinary twin did not drop the checklist option")
  }
  if _, asked := everyExpectedFingerprint(t, document, ordinary)["docs/rules.md"]; !asked {
    t.Fatal("the ordinary reference must accept one document-wide review and name its value")
  }

  refused := runIndexRule(t, document, config)
  assertProblemContains(t, refused, "Aggregate @evidence target 'docs/rules.md'")
  // The refusal returns before the review check on purpose: the citation is
  // already failing, and an Unreviewed message beside it would name a second
  // repair for a tag that must not exist here at all.
  for _, marker := range []string{"Unreviewed @evidence", "Stale @evidenceReview"} {
    if strings.Contains(strings.Join(refused, "\n"), marker) {
      t.Fatalf("a refused aggregate also reported %q:\n%s", marker, strings.Join(refused, "\n"))
    }
  }
}

/**
 * Verifies coverage survives a checklist reference that selects no host.
 *
 * Per-host reporting subsumes the population-wide answer only while a host exists to carry it. An active claim with an empty host set is unreachable through `activeGraphConfig` today, so this pins the invariant at the evaluator instead: the population question must return rather than vanish, or a future selection change would silently drop the obligation.
 *
 *  1. Evaluate a checklist reference whose claim materialized no host.
 *  2. Leave the unit unacknowledged.
 *  3. Assert the population-wide missing acknowledgement is still reported.
 */
func TestChecklistKeepsPopulationCoverageWithNoSelectedHost(t *testing.T) {
  unit := &evidenceUnit{
    ID:       "markdown:docs/rules.md:h2:1",
    Target:   "docs/rules.md#only-rule",
    Type:     artifactMarkdown,
    Symbol:   "h2",
    Path:     "docs/rules.md",
    Line:     1,
    Readable: "Markdown H2 'Only rule'",
  }
  messages := evaluateEvidenceGraph([]claimState{{
    Spec: claimSpec{
      Index:   0,
      Type:    artifactTypeScript,
      Symbols: symbolSet{"function": true},
    },
    Paths:   []string{"src/test.ts"},
    Healthy: true,
    References: []referenceState{{
      Spec: referenceSpec{
        Index:   0,
        Type:    artifactMarkdown,
        Policy:  referencePolicy{Checklist: true},
        Symbols: symbolSet{"h2": true},
      },
      Paths:        []string{"docs/rules.md"},
      Units:        []*evidenceUnit{unit},
      Scopes:       []*evidenceUnit{unit},
      UnitsByScope: map[string][]*evidenceUnit{unit.ID: {unit}},
      Healthy:      true,
    }},
  }}, nil)
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/rules.md#only-rule'")
}
