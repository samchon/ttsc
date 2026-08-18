package evidence

import "testing"

/**
 * Verifies `requireReview` matches a Prisma file-level exclusion to the review
 * written in the same unattached documentation run.
 *
 * A file-level Prisma carrier has no semantic claim host: its exclusion reaches
 * the review ledger only through the declaration-side source-position fallback.
 * Every existing Prisma review test stops at parsing, so removing that fallback
 * left every ledger exclusion permanently unreviewed while the suite stayed
 * green. The wrong-host arm also prevents a target-only lookup from letting a
 * review on a model answer for the file carrier.
 *
 *  1. Exclude one Markdown section from an unattached Prisma `///` run and read
 *     the fingerprint from its missing-review diagnostic.
 *  2. Put that review on a model and assert the file exclusion remains
 *     unreviewed.
 *  3. Move the fingerprinted review beside the exclusion and assert the graph
 *     is clean.
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
