package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies requireReview decodes on the two reference kinds that used to refuse
 * it.
 *
 * The option was refused at decode for Swagger and Prisma, because their
 * loaders reported unit identities and nothing else: an operation arrived as
 * `{method, path}`, so there was nothing to fingerprint and a review over one
 * could never expire. Both bridges now digest each unit's content on the side
 * that understands it, so the refusal has nothing left to protect.
 *
 * Decode is the layer this is asserted at, because decode is where the refusal
 * lived. The behavior it unlocks is pinned separately, against each bridge.
 *
 *  1. Declare a Swagger reference and a Prisma reference, both with
 *     `requireReview`.
 *  2. Decode the configuration.
 *  3. Assert no problem is reported and both policies carry the flag.
 */
func TestRequireReviewDecodesOnEveryReferenceKind(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"type",
      "reference":{"type":"swagger","file":"api/openapi.json","requireReview":true}
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"type",
      "reference":{
        "type":"prisma",
        "files":["prisma/**/*.prisma"],
        "symbol":"model",
        "requireReview":true
      }
    }
  ]}`))
  if len(problems) != 0 {
    t.Fatalf("expected no configuration problem, got:\n%s", strings.Join(problems, "\n"))
  }
  for index, claim := range config.Claims {
    if !claim.References[0].Policy.RequireReview {
      t.Fatalf("claim %d decoded requireReview as false", index+1)
    }
  }
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
