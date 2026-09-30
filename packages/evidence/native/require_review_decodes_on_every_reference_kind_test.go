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
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig accepts Swagger and Prisma references with requireReview and each returned claim's first policy must carry true.
 * @evidence contracts/testing.md#independent-expectations Both supported reference kinds permit the literal review flag; parsed booleans and absence of problems are independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases The two historically refused kinds share one decode call. The loop does not independently assert a two-claim result count, and no external parser is run.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewDecodesOnEveryReferenceKind is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
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
