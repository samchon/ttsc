package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies singular-or-array configuration: symbol arrays form a union while
 * reference arrays remain independently indexed obligations.
 *
 * The two array shapes look alike in JSON but carry opposite graph semantics.
 * Pinning the decoded shape prevents a refactor from flattening reference
 * obligations into one pooled evidence set.
 *
 *  1. Configure one symbol string, one symbol array, and two references.
 *  2. Decode the public configuration.
 *  3. Assert symbol union and reference boundaries survive.
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig preserves the literal symbol union and two independently indexed references.
 *
 * @evidence contracts/testing.md#independent-expectations A symbol array is one union, while reference entries are independently indexed obligations. The authored function/property union, reference count two, and separate h2 versus file/h1 selectors must not be flattened together.
 *
 * @evidence contracts/testing.md#distinguishing-cases Symbol arrays form one union while the adjacent reference array remains two obligations.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationKeepsSymbolUnionAndReferencesDistinct is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticConfigurationKeepsSymbolUnionAndReferencesDistinct(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{
    "claims": [{
      "type": "typescript",
      "files": ["src/**"],
      "symbol": ["function", "property"],
      "reference": [
        {"type": "markdown", "files": ["docs/a/**"], "symbol": "h2"},
        {"type": "markdown", "files": ["docs/b/**"], "symbol": ["file", "h1"]}
      ]
    }]
  }`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  claim := config.Claims[0]
  if got := claim.Symbols.names(); got != "function, property" {
    t.Fatalf("symbol array did not form one union: %q", got)
  }
  if len(claim.References) != 2 {
    t.Fatalf("reference array collapsed to %d obligation(s)", len(claim.References))
  }
  if claim.References[0].Symbols.names() != "h2" ||
    claim.References[1].Symbols.names() != "file, h1" {
    t.Fatalf("reference selectors crossed obligation boundaries: %+v", claim.References)
  }
}
