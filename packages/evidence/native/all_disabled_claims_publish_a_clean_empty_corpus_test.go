package evidence

import (
  "encoding/json"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies an all-disabled configuration publishes a clean, empty graph
 * corpus without requiring any project or population path to exist.
 *
 * Staged authoring begins with every claim disabled. Treating that state like
 * an empty `claims` array would reject the workflow, while resolving roots
 * before the gate would still produce loader failures.
 *
 *  1. Configure one disabled claim under unreadable roots.
 *  2. Run the project rule with no source population.
 *  3. Assert it passes and publishes an empty corpus and no hints.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check and graphRule.Hints exercises this case: Verifies an all-disabled configuration publishes a clean, empty graph corpus without requiring any project or population path to exist. The original assertions check assert it passes and publishes an empty corpus and no hints.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Staged authoring begins with every claim disabled. Treating that state like an empty `claims` array would reject the workflow, while resolving roots before the gate would still produce loader failures. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure one disabled claim under unreadable roots. Run the project rule with no source population. Assert it passes and publishes an empty corpus and no hints. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAllDisabledClaimsPublishACleanEmptyCorpus is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises graphRule.Check and graphRule.Hints within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestAllDisabledClaimsPublishACleanEmptyCorpus(t *testing.T) {
  reporter := &capturedProjectReporter{}
  context := rule.NewProjectContext(
    rule.ProjectIdentity{},
    nil,
    nil,
    rule.SeverityError,
    json.RawMessage(`{"claims":[{
      "type":"typescript",
      "disabled":true,
      "root":"missing-source-root",
      "files":["**/*.ts"],
      "reference":{"type":"markdown","root":"missing-reference-root","files":["**/*.md"]}
    }]}`),
    reporter,
  )
  graphRule{}.Check(context)
  if reporter.failed || len(reporter.messages) != 0 {
    t.Fatalf("all-disabled graph must pass cleanly: %v", reporter.messages)
  }
  cycle, ok := reporter.state.(*graphCycleState)
  if !ok || cycle == nil {
    t.Fatalf("all-disabled graph did not publish its cycle state: %T", reporter.state)
  }
  if len(cycle.Corpus.Config.Claims) != 0 ||
    len(cycle.Corpus.Markdown) != 0 ||
    len(cycle.Corpus.Prisma) != 0 ||
    len(cycle.Corpus.Swagger) != 0 {
    t.Fatalf("all-disabled graph published a non-empty corpus: %+v", cycle.Corpus)
  }
  if hints := (graphRule{}).Hints(&rule.HintContext{State: cycle}); len(hints) != 0 {
    t.Fatalf("all-disabled graph published %d hint(s)", len(hints))
  }
}
