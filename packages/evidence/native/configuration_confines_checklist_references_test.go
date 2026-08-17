package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies only a Markdown reference decodes a checklist.
 *
 * A checklist is a statement about a document read item by item, which the other populations are not: the option would ask every test to exercise every Swagger operation, or every file to cite every Prisma model. Refusing it at decode names the configuration line, where the mistake was made, instead of surfacing as coverage nobody can satisfy.
 *
 *  1. Declare the option on a Markdown reference and assert it reaches the native policy.
 *  2. Declare it on the Prisma, Swagger, and TypeScript references.
 *  3. Assert each foreign kind is refused by name at its own configuration path.
 */
func TestChecklistDecodesOnlyOnAMarkdownReference(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "checklist":true
    }
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("a Markdown checklist must decode: %v", problems)
  }
  if !config.Claims[0].References[0].Policy.Checklist {
    t.Fatalf("the option did not reach the native policy: %+v", config.Claims[0].References[0].Policy)
  }

  for _, foreign := range []struct {
    kind      string
    selection string
  }{
    {kind: "prisma", selection: `"files":["prisma/**"]`},
    {kind: "swagger", selection: `"file":"openapi.json"`},
    {kind: "typescript", selection: `"files":["contracts/**"]`},
  } {
    t.Run(foreign.kind, func(t *testing.T) {
      _, refused := decodeGraphConfig(json.RawMessage(`{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "reference":{
          "type":"` + foreign.kind + `",
          ` + foreign.selection + `,
          "checklist":true
        }
      }]}`))
      assertProblemContains(t, refused, "claims[0].reference.checklist: only a Markdown reference can be a checklist")
      assertProblemContains(t, refused, "a "+foreign.kind+" population has no reading order")
    })
  }
}

/**
 * Verifies an unreadable reference kind produces no derivative checklist refusal.
 *
 * The kind refusal names the artifact the author wrote, so an unspelled kind would make it name nothing and point at the wrong line. The type diagnostic already owns that repair, and this mirrors how the foreign-TypeScript guard stays silent for the same reason.
 *
 *  1. Declare a checklist beside a reference type that fails to decode.
 *  2. Decode the graph.
 *  3. Assert the type is reported and the checklist refusal is not.
 */
func TestChecklistIsSilentWhenTheReferenceKindDidNotDecode(t *testing.T) {
  _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"asciidoc",
      "files":["docs/**"],
      "checklist":true
    }
  }]}`))
  assertProblemContains(t, problems, "claims[0].reference.type")
  if strings.Contains(strings.Join(problems, "\n"), "can be a checklist") {
    t.Fatalf("an unspelled kind produced a derivative checklist refusal:\n%s", strings.Join(problems, "\n"))
  }
}

/**
 * Verifies a checklist is refused beside each cardinality option it contradicts.
 *
 * These are unsatisfiable rather than merely redundant: a checklist wants every host to cite every unit, which `uniqueEvidence` forbids the moment a claim has two hosts and `singleEvidencePerSymbol` forbids the moment the population has two units. Reporting at decode matters because a one-host, one-unit graph satisfies all three by accident and would ship the contradiction until the second file arrived.
 *
 *  1. Pair the checklist with each cardinality option and with both at once.
 *  2. Decode each graph, disabled and enabled alike.
 *  3. Assert each contradiction is named on its own and both are named together.
 */
func TestChecklistIsRefusedBesideTheCardinalityOptions(t *testing.T) {
  decode := func(t *testing.T, options string) []string {
    t.Helper()
    collected := []string{}
    for _, disabled := range []string{"false", "true"} {
      _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
        "type":"typescript",
        "disabled":` + disabled + `,
        "files":["src/**"],
        "reference":{
          "type":"markdown",
          "files":["docs/**"],
          "checklist":true,
          ` + options + `
        }
      }]}`))
      if len(problems) == 0 {
        t.Fatalf("disabled=%s accepted a contradictory policy", disabled)
      }
      collected = problems
    }
    return collected
  }

  unique := decode(t, `"uniqueEvidence":true`)
  assertProblemContains(t, unique, "checklist and uniqueEvidence cannot both hold")
  if strings.Contains(strings.Join(unique, "\n"), "singleEvidencePerSymbol cannot") {
    t.Fatalf("the unpaired option was reported:\n%s", strings.Join(unique, "\n"))
  }

  single := decode(t, `"singleEvidencePerSymbol":true`)
  assertProblemContains(t, single, "checklist and singleEvidencePerSymbol cannot both hold")
  if strings.Contains(strings.Join(single, "\n"), "uniqueEvidence cannot") {
    t.Fatalf("the unpaired option was reported:\n%s", strings.Join(single, "\n"))
  }

  both := decode(t, `"uniqueEvidence":true,"singleEvidencePerSymbol":true`)
  assertProblemContains(t, both, "checklist and uniqueEvidence cannot both hold")
  assertProblemContains(t, both, "checklist and singleEvidencePerSymbol cannot both hold")
}

/**
 * Verifies a checklist is refused beside gathered exclusion carriers.
 *
 * The two state opposite intents, and together they leave every host outside the carrier globs with no way to record that an item does not apply: the tag beside the host is refused as misplaced, the tag in the carrier answers for no host, and each diagnostic names the other's file. An author following either repair is sent back to the one they came from, which is a configuration to refuse rather than a state to explain.
 *
 *  1. Declare a checklist reference under a claim that confines its exclusions.
 *  2. Assert the pair is refused at the carriers, naming both repairs.
 *  3. Drop the checklist and assert the same carriers decode.
 */
func TestChecklistIsRefusedBesideGatheredExclusionCarriers(t *testing.T) {
  claim := func(policy string) json.RawMessage {
    return json.RawMessage(`{"claims":[{
      "type":"typescript",
      "files":["src/**"],
      "evidenceExcludeCarriers":["src/EXCLUSIONS.ts"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/**"]` + policy + `
      }
    }]}`)
  }
  for _, disabled := range []string{"false", "true"} {
    _, refused := decodeGraphConfig(json.RawMessage(`{"claims":[{
      "type":"typescript",
      "disabled":` + disabled + `,
      "files":["src/**"],
      "evidenceExcludeCarriers":["src/EXCLUSIONS.ts"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/**"],"checklist":true}
    }]}`))
    assertProblemContains(t, refused, "claims[0].evidenceExcludeCarriers: a checklist reference cannot be gathered into exclusion carriers")
    assertProblemContains(t, refused, "claims[0].reference makes every acknowledgement one host's own answer")
    assertProblemContains(t, refused, "Drop the carriers, drop `checklist` from that reference, or give it `noEvidenceExclude`")
  }

  if _, ordinary := decodeGraphConfig(claim("")); len(ordinary) != 0 {
    t.Fatalf("carriers must still decode without a checklist: %v", ordinary)
  }

  // A reference refusing exclusions outright has nothing for the carriers to
  // confine, so the pair is satisfiable and the carriers are governing the other
  // reference. Refusing it would contradict the published guidance that these
  // two options are the intended pairing.
  _, composed := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "evidenceExcludeCarriers":["src/EXCLUSIONS.ts"],
    "symbol":"function",
    "reference":[
      {"type":"markdown","files":["docs/principles.md"],"checklist":true,"noEvidenceExclude":true},
      {"type":"markdown","files":["docs/api/**"]}
    ]
  }]}`))
  if len(composed) != 0 {
    t.Fatalf("a checklist that accepts no exclusion must not refuse the carriers: %v", composed)
  }

  // The offending element is named, so an author with an array does not have to
  // open every one to find it.
  _, second := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "evidenceExcludeCarriers":["src/EXCLUSIONS.ts"],
    "symbol":"function",
    "reference":[
      {"type":"markdown","files":["docs/api/**"]},
      {"type":"markdown","files":["docs/principles.md"],"checklist":true}
    ]
  }]}`))
  assertProblemContains(t, second, "claims[0].reference[1] makes every acknowledgement one host's own answer")

  // A carriers glob that fails to decode owns its own diagnostic and must not
  // draw a derivative refusal on top of it.
  _, malformed := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "evidenceExcludeCarriers":[],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/**"],"checklist":true}
  }]}`))
  if strings.Contains(strings.Join(malformed, "\n"), "cannot be gathered into exclusion carriers") {
    t.Fatalf("an undecodable carriers glob drew a derivative refusal:\n%s", strings.Join(malformed, "\n"))
  }
}

/**
 * Verifies the options a checklist composes with are left alone.
 *
 * Only the two cardinality options are unsatisfiable beside it. `noEvidenceExclude` and `requireReview` are the intended companions — the first demands positive evidence from every host, the second gives each host's answer its own expiry — so a refusal that over-reached would remove the reason to want a checklist at all.
 *
 *  1. Declare a checklist with both composable options.
 *  2. Decode the graph.
 *  3. Assert every option reaches the native policy with no diagnostic.
 */
func TestChecklistComposesWithExclusionAndReviewPolicies(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "checklist":true,
      "noEvidenceExclude":true,
      "requireReview":true
    }
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("the composable options must decode beside a checklist: %v", problems)
  }
  policy := config.Claims[0].References[0].Policy
  if !policy.Checklist || !policy.NoExclude || !policy.RequireReview {
    t.Fatalf("a composable option was dropped: %+v", policy)
  }
}
