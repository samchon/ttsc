package evidence

import (
  "testing"
)

/**
 * Verifies requireReview is refused on the reference kinds that carry no
 * per-unit content.
 *
 * The Swagger and Prisma loaders cross a JavaScript process boundary that
 * reports unit identities: an operation arrives as `{method, path}`, and a model
 * arrives as a name, a documentation comment, and its field names, with every
 * type, attribute, and default left behind. There is nothing to fingerprint, so a
 * review over such a population could never expire.
 *
 * The refusal is at decode, and the two silent alternatives are why. Ignoring the
 * flag ships a policy that claims to constrain and does not. Falling back to the
 * whole-source digest both loaders already return makes every unit of a document
 * share one value, so one endpoint change expires every review of every operation
 * in it and the feature communicates nothing.
 *
 *  1. Declare a Swagger reference with `requireReview`.
 *  2. Assert the configuration is refused and the message names the reason and
 *     the repair rather than only the rejection.
 */
func TestConfigurationRefusesRequireReviewOnSwagger(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "api/openapi.json": `{"openapi":"3.1.0","paths":{}}`,
    "src/ISale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"swagger",
      "file":"api/openapi.json",
      "requireReview":true
    }
  }]}`), "reference cannot require a review yet")
}

/**
 * Verifies the same refusal for a Prisma reference.
 *
 * Prisma is the sharper half of the same cause and is pinned separately, because
 * its payload does carry *some* content. A digest built from it would be stable
 * across a field's type changing from `String` to `Int`, a removed `@unique`, and
 * a changed `@default`, which are the changes a specification review most needs
 * to expire on. A partially informed fingerprint is worse than none: it reports
 * fresh for exactly the class of change that matters.
 *
 *  1. Declare a Prisma reference with `requireReview`.
 *  2. Assert the configuration is refused.
 */
func TestConfigurationRefusesRequireReviewOnPrisma(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "prisma/schema/sale.prisma": "model Sale {\n  id String @id\n}\n",
    "src/ISale.ts":              "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"prisma",
      "files":["prisma/schema/**/*.prisma"],
      "symbol":"model",
      "requireReview":true
    }
  }]}`), "reference cannot require a review yet")
}

/**
 * Verifies the flag decodes with the same strictness as its three siblings.
 *
 * A JSON `null` decodes into Go's false without complaint, which would make a
 * broken generator's output indistinguishable from an option nobody wrote. Only
 * the two literals are the contract, and an explicit `false` must behave exactly
 * as an omitted key so the historical behavior is reachable by writing it down.
 *
 *  1. Declare `requireReview: null` and assert it is rejected.
 *  2. Declare `requireReview: false` on an otherwise satisfied graph and assert
 *     nothing is reported.
 */
func TestRequireReviewDecodesLikeItsSiblings(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Pricing\n\nThe rate is capped at 30%.\n",
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`,
  }
  assertProblemContains(t, runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "requireReview":null
    }
  }]}`), "requireReview")
  assertNoProblems(t, runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "requireReview":false
    }
  }]}`))
}
