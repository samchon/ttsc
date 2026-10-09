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
 * A scan problem says the file materialized less than it looks like it should, and that is a hole on either side: a reference loses evidence units, a claim loses the hosts that owe acknowledgements. A whitespace-named claim file forms no target at all, so it contributes no host and leaves its obligation; the claim side must report that path itself, as the reference side does.
 *
 *  1. Point a Markdown claim at a whitespace-named file beside an ordinary one, and assert the path is reported while the ordinary file still owes its acknowledgement.
 *  2. Make that file the claim's only one, so the claim materializes no host and deactivates, and assert it still reports.
 *  3. Assert an anchorless heading in a claim file is reported, and withheld from a claim that does not read that kind.
 *  4. Assert a file both populations read reports each problem once.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies a claim population hears the scan problems its own files raise.
 *
 * @evidence contracts/testing.md#independent-expectations Whitespace paths report before claim deactivation; selected anchorless H2 reports while an H1-only claim suppresses it, and a file on both sides produces exactly one report.
 *
 * @evidence contracts/testing.md#distinguishing-cases Point a Markdown claim at a whitespace-named file beside an ordinary one, and assert the path is reported while the ordinary file still owes its acknowledgement. Make that file the claim's only one, so the claim materializes no host and deactivates, and assert it still reports. Assert an anchorless heading in a claim file is reported, and withheld from a claim that does not read that kind. Assert a file both populations read reports each problem once.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownReportsScanProblemsToClaims is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestMarkdownReportsScanProblemsToClaims(t *testing.T) {
  unaddressable := runIndexRule(t, map[string]string{
    "docs/rules.md":       "## Only {#only}\n",
    "plans/alpha beta.md": "## Section one\n\nAlpha.\n",
    "plans/gamma.md":      "## Section two {#section-two}\n\nGamma.\n",
  }, scanProblemGraph)
  assertProblemContains(t, unaddressable, "Markdown file 'plans/alpha beta.md' cannot form an evidence target because its path contains whitespace")
  // The obligation the surviving file owes is unchanged, so the path report adds
  // a diagnostic rather than replacing one.
  assertProblemContains(t, unaddressable, "Missing acknowledgement for 'docs/rules.md#only'")

  // The headline shape, and the one the report rests on: the claim's only
  // file is the unaddressable one, so the claim materializes no host and
  // deactivates. It still reports, because the claim pass reads the declared
  // configuration and appends before activation drops the claim. Routing that
  // report through the activated config instead would restore the exact silence
  // the report exists to end, and every other arm here would stay green.
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
  // Anchored on something the graph does report, or a configuration that
  // produced nothing at all would satisfy the guard above by accident.
  assertProblemContains(t, withheld, "Missing acknowledgement for 'docs/rules.md#only'")

  // One file read by both a claim and a reference reports each problem once.
  // Both phases project problems from the same captured scan. The reporter
  // still coalesces their repeated messages, including unreadable tags, while
  // selection and severity remain phase-specific.
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
