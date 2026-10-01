package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies an unreadable reference kind produces no derivative checklist refusal.
 *
 * The kind refusal names the artifact the author wrote, so an unspelled kind would make it name nothing and point at the wrong line. The type diagnostic already owns that repair, and this mirrors how the foreign-TypeScript guard stays silent for the same reason.
 *
 *  1. Declare a checklist beside a reference type that fails to decode.
 *  2. Decode the graph.
 *  3. Assert the type is reported and the checklist refusal is not.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts an unknown reference kind reports its type failure without a derivative checklist refusal.
 *
 * @evidence contracts/testing.md#independent-expectations An unknown asciidoc discriminator has its own type repair. The literal type-path finding must appear and no derivative checklist refusal may be invented for an undecoded kind.
 *
 * @evidence contracts/testing.md#distinguishing-cases An unknown reference kind reports its type failure without a derivative checklist refusal.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticChecklistIsSilentWhenTheReferenceKindDidNotDecode is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticChecklistIsSilentWhenTheReferenceKindDidNotDecode(t *testing.T) {
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
