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
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot uses the installed Prisma parser for a file-level exclusion; a token on Sale must leave it unreviewed, while the same token beside the file carrier must pass.
 * @evidence contracts/testing.md#independent-expectations A file-level carrier is matched by its source position, not by an unrelated model's review. The diagnostic-derived token cannot independently establish hashing.
 * @evidence contracts/testing.md#distinguishing-cases Bare, wrong-model-host and correctly co-located review states share one workspace root and fixed Markdown content.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewMatchesAPrismaFileLevelExclusion is the selectable E2E Go entry under tests/test-evidence/go/e2e. Its original local cases execute through the native-package overlay runner and the actual installed parser process; its closure and assertions remain owned by this entry.
 * @evidence contracts/e2e.md#necessary-boundary runIndexRuleAtRoot loads the schema through the installed Prisma Node bridge before graph review matching. This tests whether real unattached documentation carriers reach the source-position fallback rather than only testing a hand-built declaration.
 * @evidence contracts/e2e.md#shared-execution One prismaBridgeRoot and compiled linked loader prerequisites serve this entry's bare, wrong-host and corrected-ledger checks. The run closure rewrites supplied schema/ledger content without rebuilding the package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The local root belongs to this Test and is cleaned after its sequential checks. Each run creates parsed inputs from the current strings; the fixed Markdown fingerprint may be reused because its cited content remains unchanged, not because schema carrier placement is equivalent.
 * @evidence contracts/e2e.md#preserved-coverage TestRequireReviewMatchesAPrismaFileLevelExclusion keeps the original missing-review and wrong-model-host failures, nonempty token extraction, and final clean colocated review at this E2E address.
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
