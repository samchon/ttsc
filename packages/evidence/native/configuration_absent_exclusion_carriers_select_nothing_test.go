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
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts each of the three supported claim kinds keeps an empty carrier selection when the option is omitted.
 *
 * @evidence contracts/testing.md#independent-expectations Carrier selection is opt-in on the shared claim base. Omission must retain zero patterns for all three supported claim kinds; the helper prints raw patterns only when that assertion fails.
 *
 * @evidence contracts/testing.md#distinguishing-cases Each of the three supported claim kinds keeps an empty carrier selection when the option is omitted.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticAbsentExclusionCarriersSelectNothing is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
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
