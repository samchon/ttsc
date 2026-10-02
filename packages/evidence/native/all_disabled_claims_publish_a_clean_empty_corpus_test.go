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
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check is run through rule.NewProjectContext with no sources and one disabled TypeScript claim whose root and reference root name directories that do not exist; the capturing reporter must record no failure or message, the published graphCycleState must hold zero claims and empty Markdown, Prisma and Swagger corpora, and graphRule.Hints on that state must return no hint.
 * @evidence contracts/testing.md#independent-expectations The expectation is the staged-authoring contract that a configuration whose claims are all disabled passes silently with an empty published corpus; the roots are deliberately nonexistent, so any attempt to resolve them before the disabled gate would surface as a loader message.
 * @evidence contracts/testing.md#distinguishing-cases A single disabled claim with missing roots against an enabled-claim case that would report a root failure; mixed enabled and disabled claims are owned by sibling configuration entries.
 * @evidence contracts/testing.md#execution-ownership TestAllDisabledClaimsPublishACleanEmptyCorpus is a Go unit entry in the native test process; it builds the project context in memory with no source files or filesystem fixtures, and starts no consumer install or product host.
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
