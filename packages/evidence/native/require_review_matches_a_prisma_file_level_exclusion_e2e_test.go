//go:build e2e

package evidence

import "testing"

/**
 * Verifies `requireReview` matches a Prisma file-level exclusion to the review
 * written in the same unattached documentation run.
 *
 * A file-level Prisma carrier has no semantic claim host: its exclusion reaches
 * the review ledger only through the declaration-side source-position fallback.
 * Parsing-only coverage does not exercise that fallback; without it, a ledger
 * exclusion remains unreviewed despite a review in its own file-level run. The wrong-host arm also prevents a target-only lookup from letting a
 * review on a model answer for the file carrier.
 *
 *  1. Exclude one Markdown section from an unattached Prisma `///` run and read
 *     the fingerprint from its missing-review diagnostic.
 *  2. Put that review on a model and assert the file exclusion remains
 *     unreviewed.
 *  3. Move the fingerprinted review beside the exclusion and assert the graph
 *     is clean.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot uses the built Prisma parser for a file-level exclusion; a token on Sale must leave it unreviewed, while the same token beside the file carrier must pass.
 * @evidence contracts/testing.md#independent-expectations A file-level carrier is matched by its source position, not by an unrelated model's review. The diagnostic-derived token cannot independently establish hashing.
 * @evidence contracts/testing.md#distinguishing-cases Bare, wrong-model-host and correctly co-located review states share one workspace root and fixed Markdown content.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewMatchesAPrismaFileLevelExclusion is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls runIndexRuleAtRoot three times through its run closure (project rule plus loadPrismaInventories; Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary runIndexRuleAtRoot loads the schema through the installed Prisma Node bridge before graph review matching. This tests whether real unattached documentation carriers reach the source-position fallback rather than only testing a hand-built declaration.
 * @evidence contracts/e2e.md#shared-execution One prismaBridgeRoot is shared by the three runIndexRuleAtRoot runs; each run rewrites schema and ledger content, so a run launches a Node child only when its schema bytes have not been parsed before in the process (the second run's schema differs from the first and third).
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The local root belongs to this Test and is cleaned after its sequential checks. Each run creates parsed inputs from the current strings; the fixed Markdown fingerprint may be reused because its cited content remains unchanged, not because schema carrier placement is equivalent.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts the missing-review finding and fingerprint extraction (L55-L72), the wrong-host failure (L76) and the clean colocated-review run (L85).
 */
func TestRequireReviewMatchesAPrismaFileLevelExclusion(t *testing.T) {
  config := `{"claims":[{
    "type":"prisma",
    "files":["prisma/**/*.prisma","prisma/exclude.schema"],
    "symbol":"model",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "requireReview":true
    }
  }]}`
  document := "## Pricing\n\nThe rate is capped at 30%.\n"
  model := "model Sale {\n  id String @id\n}\n"
  bareLedger := "/// @evidenceExclude docs/spec.md#pricing The schema stores no pricing policy.\n\n"
  root := prismaBridgeRoot(t, nil)
  run := func(schema string, ledger string) []string {
    return runIndexRuleAtRoot(t, root, map[string]string{
      "docs/spec.md":          document,
      "prisma/schema.prisma":  schema,
      "prisma/exclude.schema": ledger,
    }, config)
  }

  unreviewed := run(model, bareLedger)
  assertProblemContains(
    t,
    unreviewed,
    "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'",
  )
  fingerprint := ""
  for _, message := range unreviewed {
    if asksForAFingerprint(message) {
      fingerprint = shapedFingerprint(message)
      if fingerprint != "" {
        break
      }
    }
  }
  if fingerprint == "" {
    t.Fatalf("expected the exclusion finding to name a fingerprint, got:\n%v", unreviewed)
  }

  wrongHost := "/// @evidenceExcludeReview docs/spec.md#pricing #" + fingerprint +
    " Read the section from the wrong host.\n" + model
  assertProblemContains(
    t,
    run(wrongHost, bareLedger),
    "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'",
  )

  reviewedLedger := "/// @evidenceExclude docs/spec.md#pricing The schema stores no pricing policy.\n" +
    "/// @evidenceExcludeReview docs/spec.md#pricing #" + fingerprint +
    " Read the section: it names no stored model.\n\n"
  assertNoProblems(t, run(model, reviewedLedger))
}
