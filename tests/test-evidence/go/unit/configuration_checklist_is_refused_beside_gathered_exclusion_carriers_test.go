package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies a checklist is refused beside gathered exclusion carriers.
 *
 * The two state opposite intents, and together they leave every host outside the carrier globs with no way to record that an item does not apply: the tag beside the host is refused as misplaced, the tag in the carrier answers for no host, and each diagnostic names the other's file. An author following either repair is sent back to the one they came from, which is a configuration to refuse rather than a state to explain.
 *
 *  1. Declare a checklist reference under a claim that confines its exclusions.
 *  2. Assert the pair is refused at the carriers, naming both repairs.
 *  3. Drop the checklist and assert the same carriers decode.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts ordinary carriers and exclusion-refusing checklists remain valid; enabled and disabled contradictory pairs, a second reference and malformed carriers retain their distinct diagnostics.
 *
 * @evidence contracts/testing.md#independent-expectations Claim carriers gather exclusions, whereas a checklist requires each host's own answer. The contract permits ordinary carriers and noEvidenceExclude companions, rejects enabled/disabled contradictory pairs at their literal paths, and avoids derivative refusal when carriers cannot decode.
 *
 * @evidence contracts/testing.md#distinguishing-cases Ordinary carriers and exclusion-refusing checklists remain valid; enabled and disabled contradictory pairs, a second reference and malformed carriers retain their distinct diagnostics.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticChecklistIsRefusedBesideGatheredExclusionCarriers is the selectable unit entry in tests/test-evidence/go/unit, compiled into the shared native Go package by the repository overlay. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticChecklistIsRefusedBesideGatheredExclusionCarriers(t *testing.T) {
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
