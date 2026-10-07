package evidence

import (
  "encoding/json"
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
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a Markdown checklist is admitted while Prisma, Swagger and TypeScript checklists report their own artifact-specific refusals.
 *
 * @evidence contracts/testing.md#independent-expectations The Markdown checklist contract is item-by-item reading; Prisma, Swagger, and TypeScript have no reading order. The literal true policy and artifact-specific refusal paths distinguish those supported and forbidden shapes.
 *
 * @evidence contracts/testing.md#distinguishing-cases A Markdown checklist is admitted while Prisma, Swagger and TypeScript checklists report their own artifact-specific refusals.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticChecklistDecodesOnlyOnAMarkdownReference is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticChecklistDecodesOnlyOnAMarkdownReference(t *testing.T) {
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
