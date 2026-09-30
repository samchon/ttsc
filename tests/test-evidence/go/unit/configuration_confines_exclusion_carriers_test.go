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
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts markdown, Prisma and TypeScript claims preserve exact positive and exclusion glob spellings independently.
 *
 * @evidence contracts/testing.md#independent-expectations The shared claim base publishes evidenceExcludeCarriers for Markdown, Prisma, and TypeScript. The three independently authored positive/exclusion pattern lists must be retained exactly, including their original spelling.
 *
 * @evidence contracts/testing.md#distinguishing-cases Markdown, Prisma and TypeScript claims preserve exact positive and exclusion glob spellings independently.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticExclusionCarriersDecodeOnEveryClaimKind is the selectable unit entry in tests/test-evidence/go/unit, compiled into the shared native Go package by the repository overlay. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
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
