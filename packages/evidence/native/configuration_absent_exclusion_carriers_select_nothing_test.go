package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies an undeclared carrier selection stays the empty zero value.
 *
 * The property is opt-in, and its absence is the historical graph exactly: an `@evidenceExclude` remains eligible everywhere it was eligible before this selector existed. A decoder that defaulted to any non-empty selection would confine every exclusion in every configuration written before the property shipped.
 *
 *  1. Decode a claim of each kind with no `evidenceExcludeCarriers`.
 *  2. Inspect the native carrier selection of each.
 *  3. Assert every one of them carries no pattern at all.
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig decodes three claims (Markdown, Prisma and TypeScript claim kinds, none with `evidenceExcludeCarriers`) without problems, and the test requires every decoded claim to have zero ExclusionCarriers patterns.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the opt-in contract: omitting the carrier selection must decode to an empty selection for every claim kind, so exclusions stay eligible wherever they were before the option existed; the failure message prints the patterns the decoder invented.
 * @evidence contracts/testing.md#distinguishing-cases One omitted-property case per supported claim kind; configurations that do declare carriers, malformed shapes and confinement rules are owned by sibling configuration entries.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticAbsentExclusionCarriersSelectNothing is a Go unit entry in the native test process; it calls decodeGraphConfig on an in-memory JSON string with no filesystem, consumer install, artifact build or product host.
 */
func TestEvidenceSemanticAbsentExclusionCarriersSelectNothing(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[
    {
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":"model"}
    },
    {
      "type":"prisma",
      "files":["prisma/**/*.prisma"],
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }
  ]}`))
  if len(problems) != 0 {
    t.Fatalf("an omitted carrier selection must decode: %v", problems)
  }
  for index, claim := range config.Claims {
    if len(claim.ExclusionCarriers.Patterns) != 0 {
      t.Fatalf(
        "claim %d (%s) invented a carrier selection: %q",
        index,
        claim.Type,
        declaredCarrierGlobs(claim.ExclusionCarriers),
      )
    }
  }
}
