package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

// declaredCarrierGlobs reads back the author's own spelling of a carrier
// selection. The raw pattern is what a diagnostic has to quote, so a decode
// that silently normalized `!src/legacy/**` into something else would still
// pass a length check while naming a path nobody wrote.
func declaredCarrierGlobs(set globSet) string {
  patterns := make([]string, 0, len(set.Patterns))
  for _, pattern := range set.Patterns {
    patterns = append(patterns, pattern.Raw)
  }
  return strings.Join(patterns, ", ")
}

/**
 * Verifies every claim kind can confine its exclusions to declared carriers.
 *
 * Central exclusion ledgers are a property of the claim, not of one artifact loader: a Markdown requirement set, a Prisma schema folder, and a TypeScript population each have a file where reviewed non-applicability belongs. Decoding the selection on only one kind would leave an identical public property silently inert on the other two, which reads exactly like a carrier glob that happens to match nothing.
 *
 *  1. Declare `evidenceExcludeCarriers` on a Markdown, a Prisma, and a TypeScript claim.
 *  2. Decode the graph through the shared claim boundary.
 *  3. Assert each claim retains the exact glob spelling it was given.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts markdown, Prisma and TypeScript claims preserve exact positive and exclusion glob spellings independently.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Markdown, Prisma and TypeScript claims preserve exact positive and exclusion glob spellings independently.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticExclusionCarriersDecodeOnEveryClaimKind(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[
    {
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "evidenceExcludeCarriers":["docs/EVIDENCE_EXCLUDE.md"],
      "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":"model"}
    },
    {
      "type":"prisma",
      "files":["prisma/**/*.prisma","prisma/exclude.schema"],
      "evidenceExcludeCarriers":["prisma/exclude.schema"],
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"function",
      "evidenceExcludeCarriers":["src/**/*_EVIDENCE_EXCLUDE.ts","!src/legacy/**"],
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }
  ]}`))
  if len(problems) != 0 {
    t.Fatalf("every claim kind must accept a carrier selection: %v", problems)
  }
  if len(config.Claims) != 3 {
    t.Fatalf("expected three claims, got %d", len(config.Claims))
  }
  expected := []string{
    "docs/EVIDENCE_EXCLUDE.md",
    "prisma/exclude.schema",
    "src/**/*_EVIDENCE_EXCLUDE.ts, !src/legacy/**",
  }
  for index, claim := range config.Claims {
    if got := declaredCarrierGlobs(claim.ExclusionCarriers); got != expected[index] {
      t.Fatalf(
        "claim %d (%s) carriers: %q, want %q",
        index,
        claim.Type,
        got,
        expected[index],
      )
    }
  }
}

/**
 * Verifies an undeclared carrier selection stays the empty zero value.
 *
 * The property is opt-in, and its absence is the historical graph exactly: an `@evidenceExclude` remains eligible everywhere it was eligible before this selector existed. A decoder that defaulted to any non-empty selection would confine every exclusion in every configuration written before the property shipped.
 *
 *  1. Decode a claim of each kind with no `evidenceExcludeCarriers`.
 *  2. Inspect the native carrier selection of each.
 *  3. Assert every one of them carries no pattern at all.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts each of the three supported claim kinds keeps an empty carrier selection when the option is omitted.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Each of the three supported claim kinds keeps an empty carrier selection when the option is omitted.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
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

/**
 * Verifies a misspelled carrier property is still rejected by name.
 *
 * The accepted-property set is the only thing standing between a typo and a claim that confines nothing while reading as if it confines everything. Widening that set is the correct way to add the property; deleting the rejection would be the cheap one, and this case tells the two apart by requiring the rejection to fire *and* the offered list to name the real spelling.
 *
 *  1. Write the singular misspelling `evidenceExcludeCarrier`.
 *  2. Decode the claim.
 *  3. Assert the unknown-property diagnostic fires and offers the plural name.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a singular misspelling must be refused, offer the plural key and keep the rejected claim out of the model.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases A singular misspelling must be refused, offer the plural key and keep the rejected claim out of the model.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticMisspelledExclusionCarrierPropertyIsRejected(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"function",
    "evidenceExcludeCarrier":["src/EVIDENCE_EXCLUDE.ts"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`))
  assertProblemContains(t, problems, "claims[0].evidenceExcludeCarrier: unknown property")
  assertProblemContains(t, problems, "evidenceExcludeCarriers")
  if len(config.Claims) != 0 {
    t.Fatalf("a rejected claim must not reach the graph: %+v", config.Claims)
  }
}

/**
 * Verifies a carrier selection enforces the same shape contract as `files`.
 *
 * A carrier glob set decides where reviewed non-applicability may be written, so every malformed spelling of it has the same consequence: an exclusion the author believes is confined, silently governed by a selection the decoder guessed at. An only-negative array is the sharpest case, because it is syntactically a glob set and semantically selects no file at all.
 *
 *  1. Supply a bare string, an empty array, a non-string element, and only exclusions.
 *  2. Decode each through the claim boundary.
 *  3. Assert each is refused at its exact public path and produces no claim.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts bare string, empty array, non-string element and exclusion-only carrier sets are rejected at their literal paths with no admitted claim.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Bare string, empty array, non-string element and exclusion-only carrier sets are rejected at their literal paths with no admitted claim.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
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
