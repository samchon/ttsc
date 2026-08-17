package evidence

import (
  "strings"
  "testing"
)

const scanProblemGraph = `{"claims":[{
  "type":"markdown",
  "files":["plans/**"],
  "symbol":"h2",
  "reference":{"type":"markdown","files":["docs/rules.md"],"symbol":"h2"}
}]}`

/**
 * Verifies a claim population hears the scan problems its own files raise.
 *
 * A scan problem says the file materialized less than it looks like it should, and that is a hole on either side: a reference loses evidence units, a claim loses the hosts that owe acknowledgements. Only the reference side was told. The claim side is the one that stayed silent in the worse direction, because a whitespace-named claim file forms no target at all, so it contributes no host, leaves the obligation, and reported nothing on its way out.
 *
 *  1. Point a Markdown claim at a whitespace-named file beside an ordinary one, and assert the path is reported while the ordinary file still owes its acknowledgement.
 *  2. Make that file the claim's only one, so the claim materializes no host and deactivates, and assert it still reports.
 *  3. Assert an anchorless heading in a claim file is reported, and withheld from a claim that does not read that kind.
 *  4. Assert a file both populations read reports each problem once.
 */
func TestMarkdownReportsScanProblemsToClaims(t *testing.T) {
  unaddressable := runIndexRule(t, map[string]string{
    "docs/rules.md":       "## Only {#only}\n",
    "plans/alpha beta.md": "## Section one\n\nAlpha.\n",
    "plans/gamma.md":      "## Section two {#section-two}\n\nGamma.\n",
  }, scanProblemGraph)
  assertProblemContains(t, unaddressable, "Markdown file 'plans/alpha beta.md' cannot form an evidence target because its path contains whitespace")
  // The obligation the surviving file owes is unchanged, so the new report adds
  // a diagnostic rather than replacing one.
  assertProblemContains(t, unaddressable, "Missing acknowledgement for 'docs/rules.md#only'")

  // The headline shape, and the one the whole fix rests on: the claim's only
  // file is the unaddressable one, so the claim materializes no host and
  // deactivates. It still reports, because the claim pass reads the declared
  // configuration and appends before activation drops the claim. Routing that
  // report through the activated config instead would restore the exact silence
  // this fix exists to end, and every other arm here would stay green.
  alone := runIndexRule(t, map[string]string{
    "docs/rules.md":       "## Only {#only}\n",
    "plans/alpha beta.md": "## Section one\n\nAlpha.\n",
  }, scanProblemGraph)
  if len(alone) != 1 {
    t.Fatalf("expected the unaddressable path alone, got:\n%s", strings.Join(alone, "\n"))
  }
  assertProblemContains(t, alone, "Markdown file 'plans/alpha beta.md' cannot form an evidence target")

  anchorless := runIndexRule(t, map[string]string{
    "docs/rules.md":  "## Only {#only}\n",
    "plans/alpha.md": "## ---\n\nAlpha.\n\n## Section one {#section-one}\n\nMore.\n",
  }, scanProblemGraph)
  assertProblemContains(t, anchorless, "Markdown evidence unit at plans/alpha.md:1 has no resolvable anchor")

  // A problem filed under a kind this population does not read stays withheld,
  // which is the rule the reference side already obeyed and the reason the claim
  // is matched on its own selector rather than on the file alone.
  withheld := runIndexRule(t, map[string]string{
    "docs/rules.md":  "## Only {#only}\n",
    "plans/alpha.md": "# Alpha {#alpha}\n\n## ---\n\nBody.\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["plans/**"],
    "symbol":"h1",
    "reference":{"type":"markdown","files":["docs/rules.md"],"symbol":"h2"}
  }]}`)
  if strings.Contains(strings.Join(withheld, "\n"), "has no resolvable anchor") {
    t.Fatalf("an H2 problem reached a claim that reads only H1:\n%s", strings.Join(withheld, "\n"))
  }

  // One file read by both a claim and a reference reports each problem once.
  // The mechanism is the reporter, not this predicate: the scan runs twice, once
  // over the declared claim populations and once over the activated config, and
  // each pass appends the same message. `reportProblems` sorts and drops the
  // adjacent duplicate. That reliance predates this change, since an unreadable
  // tag is already appended by both passes; the case is a regression guard on
  // the reporter rather than on the line above it.
  both := runIndexRule(t, map[string]string{
    "plans/alpha.md": "## ---\n\n<!-- @evidence plans/alpha.md#kept Self. -->\n\n## Kept {#kept}\n\nBody.\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["plans/**"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["plans/**"],"symbol":"h2"}
  }]}`)
  if count := countProblemsContaining(both, "has no resolvable anchor"); count != 1 {
    t.Fatalf("expected one anchor problem for a file both populations read, got %d:\n%s", count, strings.Join(both, "\n"))
  }
}
