package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies a carrier selection enforces the same shape contract as `files`.
 *
 * A carrier glob set decides where reviewed non-applicability may be written, so every malformed spelling of it has the same consequence: an exclusion the author believes is confined, silently governed by a selection the decoder guessed at. An only-negative array is the sharpest case, because it is syntactically a glob set and semantically selects no file at all.
 *
 *  1. Supply a bare string, an empty array, a non-string element, and only exclusions.
 *  2. Decode each through the claim boundary.
 *  3. Assert each is refused at its exact public path and produces no claim.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts bare string, empty array, non-string element and exclusion-only carrier sets are rejected at their literal paths with no admitted claim.
 *
 * @evidence contracts/testing.md#independent-expectations Carrier globs share the documented non-empty string-array and positive-selection contract. Bare strings, empty arrays, numeric elements, and only-negative arrays are independent malformed inputs, with the authored repair fragment required where supplied.
 *
 * @evidence contracts/testing.md#distinguishing-cases Bare string, empty array, non-string element and exclusion-only carrier sets are rejected at their literal paths with no admitted claim.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticExclusionCarriersRejectMalformedShapes is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticExclusionCarriersRejectMalformedShapes(t *testing.T) {
  cases := []struct {
    name     string
    value    string
    expected string
  }{
    {
      name:  "bare string",
      value: `"src/EVIDENCE_EXCLUDE.ts"`,
    },
    {
      name:     "empty array",
      value:    `[]`,
      expected: "at least one positive glob",
    },
    {
      name:  "non-string element",
      value: `["src/EVIDENCE_EXCLUDE.ts",7]`,
    },
    {
      name:     "only exclusions",
      value:    `["!src/legacy/**","!src/generated/**"]`,
      expected: "at least one positive glob",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
        "type":"typescript",
        "files":["src/**/*.ts"],
        "symbol":"function",
        "evidenceExcludeCarriers":` + test.value + `,
        "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
      }]}`))
      assertProblemContains(t, problems, "claims[0].evidenceExcludeCarriers")
      if test.expected != "" {
        assertProblemContains(t, problems, test.expected)
      }
      if len(config.Claims) != 0 {
        t.Fatalf("a malformed carrier selection must not produce a claim: %+v", config.Claims)
      }
    })
  }
}
