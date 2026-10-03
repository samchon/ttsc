package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies every reference kind accepts the same reference-local policy.
 *
 * The policy belongs to the acknowledgement relation rather than to an artifact loader. Decoding it in only the Swagger path would leave identical configuration properties silently unavailable on Markdown, Prisma, or TypeScript references.
 *
 *  1. Configure all four reference kinds with every option enabled.
 *  2. Decode the graph through the shared reference boundary.
 *  3. Assert each reference retains all three enabled options.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts markdown, Prisma, Swagger and TypeScript reference decoders each retain the same three enabled reference-local options.
 *
 * @evidence contracts/testing.md#independent-expectations Shared reference policies belong to the relation, so Markdown, Prisma, Swagger, and TypeScript must all retain the three independently authored true flags: noEvidenceExclude, uniqueEvidence, and singleEvidencePerSymbol.
 *
 * @evidence contracts/testing.md#distinguishing-cases Markdown, Prisma, Swagger and TypeScript reference decoders each retain the same three enabled reference-local options.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticReferencePolicyAppliesToEveryReferenceKind is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticReferencePolicyAppliesToEveryReferenceKind(t *testing.T) {
  policy := `"noEvidenceExclude":true,
    "uniqueEvidence":true,
    "singleEvidencePerSymbol":true`
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"markdown","files":["docs/**"],` + policy + `},
      {"type":"prisma","files":["prisma/**"],` + policy + `},
      {"type":"swagger","file":"openapi.json",` + policy + `},
      {"type":"typescript","files":["contracts/**"],` + policy + `}
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  if len(config.Claims[0].References) != 4 {
    t.Fatalf("expected four references, got %d", len(config.Claims[0].References))
  }
  for index, reference := range config.Claims[0].References {
    policy := reference.Policy
    if !policy.NoExclude ||
      !policy.UniqueEvidence ||
      !policy.SingleEvidencePerSymbol {
      t.Fatalf("reference %d lost its policy: %+v", index, policy)
    }
  }
}
