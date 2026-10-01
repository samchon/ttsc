package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies Swagger coverage: a declaration acknowledges exactly its matching
 * operation and leaves an adjacent operation missing.
 *
 * This exercises Swagger through the same claim/reference materialization and
 * evaluation path as Markdown and TypeScript without relying on the Node
 * bridge. A quiet happy path alone would not prove operation obligations fire.
 *
 *  1. Materialize POST and GET operations from one configured source.
 *  2. Cite only POST from a selected TypeScript declaration host.
 *  3. Assert GET alone receives the missing-acknowledgement diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig, parseTypeScriptInventory, swaggerOperationUnit, materializeClaimStates and evaluateEvidenceGraph run over a two-operation Swagger inventory and one citation of POST:/members; the joined diagnostics must contain a missing acknowledgement for GET:/members/{id} and none for POST:/members.
 * @evidence contracts/testing.md#independent-expectations The authored two-operation inventory and single POST citation fix which obligation remains.
 * @evidence contracts/testing.md#distinguishing-cases One citation cannot satisfy an uncited sibling; no normalizer runs.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerOperationsParticipateInCoverage is a selectable native Go unit entry. It builds Swagger units from literals with swaggerOperationUnit, parses the TypeScript citation in memory and evaluates the graph without a Node normalizer in-process; no consumer, Node process, native build or product host is started.
 */
func TestSwaggerOperationsParticipateInCoverage(t *testing.T) {
  config, configProblems := decodeGraphConfig(json.RawMessage(`{
    "claims": [{
      "type": "typescript",
      "files": ["src/ref.ts"],
      "symbol": "type",
      "reference": {"type": "swagger", "file": "api/openapi.json"}
    }]
  }`))
  if len(configProblems) != 0 {
    t.Fatalf("unexpected config diagnostics: %v", configProblems)
  }
  claimInventory := parseTypeScriptInventory(
    t,
    "src/ref.ts",
    "/** @evidence POST:/members Implements member creation. */\nexport interface Ref {}\n",
  )
  post, problem := swaggerOperationUnit(
    "api/openapi.json",
    swaggerOperation{Method: "POST", Path: "/members"},
  )
  if problem != "" {
    t.Fatal(problem)
  }
  get, problem := swaggerOperationUnit(
    "api/openapi.json",
    swaggerOperation{Method: "GET", Path: "/members/{id}"},
  )
  if problem != "" {
    t.Fatal(problem)
  }
  states, stateProblems := materializeClaimStates(
    anchoredGraph("", config),
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    map[string]*artifactInventory{
      "api/openapi.json": {
        Path:  "api/openapi.json",
        Type:  artifactSwagger,
        Units: []*evidenceUnit{post, get},
      },
    },
    map[string]*artifactInventory{"src/ref.ts": claimInventory},
    newTypeScriptLoader("", map[string]*artifactInventory{"src/ref.ts": claimInventory}),
  )
  problems := append(
    stateProblems,
    evaluateEvidenceGraph(
      states,
      newTypeScriptLoader("", map[string]*artifactInventory{"src/ref.ts": claimInventory}),
    )...,
  )
  joined := strings.Join(problemMessages(problems), "\n")
  if !strings.Contains(joined, "Missing acknowledgement for 'GET:/members/{id}'") {
    t.Fatalf("uncited GET operation did not fail coverage:\n%s", joined)
  }
  if strings.Contains(joined, "Missing acknowledgement for 'POST:/members'") {
    t.Fatalf("cited POST operation remained missing:\n%s", joined)
  }
}
