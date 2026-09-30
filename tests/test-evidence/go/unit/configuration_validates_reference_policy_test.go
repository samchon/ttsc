package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies reference policy defaults preserve the original reference contract.
 *
 * Each option strengthens a single reference only when it is written as `true`. An omitted option and an explicit `false` therefore need the same zero-value native model, or merely adding the public properties would change every existing graph.
 *
 *  1. Decode one reference with no options and one declaring every option false.
 *  2. Inspect both native reference models.
 *  3. Assert every option retains its behavior-preserving zero value.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts omitted reference policy contrasts all four explicitly false policy flags without changing the zero-value model.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Omitted reference policy contrasts all four explicitly false policy flags without changing the zero-value model.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticReferencePolicyDefaultsPreserveReferenceBehavior(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"markdown","files":["docs/a.md"]},
      {
        "type":"markdown",
        "files":["docs/b.md"],
        "noEvidenceExclude":false,
        "uniqueEvidence":false,
        "singleEvidencePerSymbol":false,
        "checklist":false
      }
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  for index, reference := range config.Claims[0].References {
    policy := reference.Policy
    if policy.NoExclude ||
      policy.UniqueEvidence ||
      policy.SingleEvidencePerSymbol ||
      policy.Checklist {
      t.Fatalf("reference %d did not preserve zero-value behavior: %+v", index, policy)
    }
  }
}

/**
 * Verifies every reference kind accepts the same reference-local policy.
 *
 * The policy belongs to the acknowledgement relation rather than to an artifact loader. Decoding it in only the Swagger path would leave identical configuration properties silently unavailable on Markdown, Prisma, or TypeScript references.
 *
 *  1. Configure all four reference kinds with every option enabled.
 *  2. Decode the graph through the shared reference boundary.
 *  3. Assert each reference retains all three enabled options.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts markdown, Prisma, Swagger and TypeScript reference decoders each retain the same three enabled reference-local options.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Markdown, Prisma, Swagger and TypeScript reference decoders each retain the same three enabled reference-local options.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
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

/**
 * Verifies each policy option rejects every non-boolean runtime shape.
 *
 * TypeScript catches most malformed literals, but JavaScript and unchecked generated config reach the native decoder directly. A JSON null is especially dangerous, because Go's decoder otherwise turns it into `false` — which looks exactly like an option nobody wrote.
 *
 *  1. Supply numbers, strings, arrays, objects, and nulls for each option.
 *  2. Decode each through a disabled claim as well as an enabled one.
 *  3. Assert the complete public option path names every rejection.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts each of four policy flags rejects number, zero, string, array, object and null on both enabled and disabled claims.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Each of four policy flags rejects number, zero, string, array, object and null on both enabled and disabled claims.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticReferencePolicyRejectsMalformedRuntimeShapes(t *testing.T) {
  invalid := []struct {
    name  string
    value string
  }{
    {name: "number", value: "1"},
    {name: "zero", value: "0"},
    {name: "string", value: `"true"`},
    {name: "array", value: `[]`},
    {name: "object", value: `{}`},
    {name: "null", value: `null`},
  }
  for _, property := range []string{
    "noEvidenceExclude",
    "uniqueEvidence",
    "singleEvidencePerSymbol",
    "checklist",
  } {
    for _, test := range invalid {
      t.Run(test.name+" "+property, func(t *testing.T) {
        for _, disabled := range []string{"false", "true"} {
          _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
            "type":"typescript",
            "disabled":` + disabled + `,
            "files":["src/**"],
            "reference":{
              "type":"markdown",
              "files":["docs/**"],
              "` + property + `":` + test.value + `
            }
          }]}`))
          expected := property + ": expected a boolean"
          if !strings.Contains(strings.Join(problems, "\n"), expected) {
            t.Fatalf("disabled=%s did not reject %s at %q: %v", disabled, test.name, expected, problems)
          }
        }
      })
    }
  }
}

/**
 * Verifies the policy belongs to a reference object and to no other level.
 *
 * A claim-level option would silently pool constraints across independent references, letting a permitted Markdown exclusion inherit a strict Swagger operation policy. The retired nested `acknowledgement` object must be equally dead, so configuration written against the earlier shape fails loudly instead of decoding into a policy that is silently inactive.
 *
 *  1. Put an option beside the claim selectors.
 *  2. Put the same options inside a retired nested `acknowledgement` object.
 *  3. Assert both paths report an unknown property.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts claim-level policy and retired nested acknowledgement configuration are both rejected at their distinct literal paths.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Claim-level policy and retired nested acknowledgement configuration are both rejected at their distinct literal paths.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticReferencePolicyIsRejectedOutsideAReferenceObject(t *testing.T) {
  _, claimLevel := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "noEvidenceExclude":true,
    "reference":{"type":"markdown","files":["docs/**"]}
  }]}`))
  assertProblemContains(t, claimLevel, "claims[0].noEvidenceExclude: unknown property")

  _, nested := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "acknowledgement":{"noEvidenceExclude":true,"singleEvidencePerSymbol":true}
    }
  }]}`))
  assertProblemContains(t, nested, "claims[0].reference.acknowledgement: unknown property")
}

/**
 * Verifies the exclusion-refusing option answers to its new public name only.
 *
 * `noExclude` named the tag family ambiguously: every other public spelling in this surface says `evidence` out loud, and a reader had to already know that "exclude" meant `@evidenceExclude` rather than a population exclusion glob. The rename is breaking on purpose, so the retired spelling has to fail loudly — a silently ignored `noExclude` would decode into a reference that no longer refuses anything while its author still reads the option in the config.
 *
 *  1. Decode a reference declaring `noEvidenceExclude`.
 *  2. Decode the same reference declaring the retired `noExclude`.
 *  3. Assert the new name takes effect and the old one is refused by name.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts the enabled noEvidenceExclude spelling contrasts retired noExclude, whose rejection must offer the current name.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases The enabled noEvidenceExclude spelling contrasts retired noExclude, whose rejection must offer the current name.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticReferenceExclusionPolicyAnswersToItsRenamedKey(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "noEvidenceExclude":true
    }
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("the renamed option must decode: %v", problems)
  }
  if !config.Claims[0].References[0].Policy.NoExclude {
    t.Fatalf("the renamed option did not reach the native policy: %+v", config.Claims[0].References[0].Policy)
  }

  _, retired := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "noExclude":true
    }
  }]}`))
  assertProblemContains(t, retired, "claims[0].reference.noExclude: unknown property")
  assertProblemContains(t, retired, "noEvidenceExclude")
}
