package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestSwaggerEffectiveContractsExpireOperationReviews verifies bridge digests
// reach native review policy instead of being replaced by a document cache key.
//
// 1. Normalize inherited, equivalent explicit and changed server contracts.
// 2. Materialize their operation units and a separately overridden sibling.
// 3. Accept the original review, expire it for the changed contract and preserve
//    it for equivalent or unrelated edits.
//
// @evidence contracts/testing.md#behavioral-verification One real normalizeSwaggerSources batch feeds swaggerOperationUnit, newScopeIndex, materializeClaimStates and evaluateEvidenceGraph. An original review must pass, a server change must report Stale @evidenceReview and equivalent explicit or unused-scheme edits must remain silent; the isolated sibling fingerprint must remain unchanged throughout.
// @evidence contracts/testing.md#independent-expectations OpenAPI server inheritance and override determine which authored operation changed. The initial review token is fixture setup, while accepted-to-stale and unchanged-sibling transitions independently challenge omitted contracts and whole-document hashing without a golden implementation digest.
// @evidence contracts/testing.md#distinguishing-cases Inherited versus explicit equality contrasts a changed effective server; an operation with its own server/security is the adjacent negative. An unused scheme edit changes source bytes without moving review tokens. Every named variant runs despite an independent assertion failure.
// @evidence contracts/testing.md#execution-ownership This native unit uses the existing normalizer bridge and its installed JavaScript parser child, then evaluates native rules in-process. It builds no consumer, compiler or lint host; one request supplies all document variants and its workspace-local temporary root is released by parserBridgeBatchRoot.
func TestSwaggerEffectiveContractsExpireOperationReviews(t *testing.T) {
  root, err := parserBridgeBatchRoot(t, "loadSwaggerOperations.js")
  if err != nil {
    t.Fatal(err)
  }
  document := func(server string, explicit bool, unused string) string {
    override := ""
    if explicit {
      override = `,"servers":[{"url":"https://one.invalid"}],"security":[{"Key":[]}]`
    }
    return `{"openapi":"3.0.3","info":{"title":"Reviews","version":"1"},"servers":[{"url":"` + server + `"}],"security":[{"Key":[]}],"components":{"securitySchemes":{"Key":{"type":"apiKey","in":"header","name":"X-Key"},"Unused":{"type":"apiKey","in":"header","name":"` + unused + `"}}},"paths":{"/a":{"get":{"responses":{"200":{"description":"OK"}}` + override + `}},"/isolated":{"get":{"servers":[{"url":"/isolated"}],"security":[],"responses":{"200":{"description":"OK"}}}}}}`
  }
  inputs := map[string]string{
    "original.json": document("https://one.invalid", false, "X-Unused"),
    "explicit.json": document("https://one.invalid", true, "X-Unused"),
    "changed.json": document("https://two.invalid", false, "X-Unused"),
    "unused.json": document("https://one.invalid", false, "X-Other"),
  }
  sources := []string{"original.json", "explicit.json", "changed.json", "unused.json"}
  for source, content := range inputs {
    if err := os.WriteFile(filepath.Join(root, source), []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  loaded, err := normalizeSwaggerSources(root, sources)
  if err != nil || len(loaded.Problems) != 0 || len(loaded.Documents) != len(sources) {
    t.Fatalf("complete bridge prerequisite failed: %v / %+v", err, loaded)
  }
  inventories := map[string]*artifactInventory{}
  tokens := map[string]map[string]string{}
  for _, document := range loaded.Documents {
    inventory := &artifactInventory{Path: "api.json", Type: artifactSwagger}
    problems := swaggerUnitsFromOutcome("api.json", inventory, swaggerDocumentOutcome{Operations: document.Operations})
    if len(problems) != 0 || len(inventory.Units) != 2 {
      t.Errorf("%s operation population: %+v / %+v", document.Source, problems, inventory)
      continue
    }
    inventories[document.Source] = inventory
    tokens[document.Source] = map[string]string{}
    index := newScopeIndex(inventory.Units)
    for _, unit := range inventory.Units {
      tokens[document.Source][unit.Target] = index.fingerprint(unit.ID)
    }
  }
  original := tokens["original.json"]["GET:/a"]
  if original == "" {
    t.Fatal("original operation fingerprint prerequisite is missing")
  }
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{"type":"typescript","files":["src/ref.ts"],"symbol":"type","reference":{"type":"swagger","file":"api.json","requireReview":true}}]}`))
  if len(problems) != 0 {
    t.Fatal(problems)
  }
  for _, source := range sources {
    t.Run(source, func(t *testing.T) {
      inventory := inventories[source]
      if inventory == nil {
        t.Fatal("normalization prerequisite did not materialize this source")
      }
      host := parseTypeScriptInventory(t, "src/ref.ts", "/**\n * @evidence GET:/a Implements the operation.\n * @evidenceReview GET:/a #"+original+" Reviewed server and security.\n * @evidence GET:/isolated Implements the isolated operation.\n * @evidenceReview GET:/isolated #"+tokens["original.json"]["GET:/isolated"]+" Reviewed the independent override.\n */\nexport interface Ref {}")
      loader := newTypeScriptLoader("", map[string]*artifactInventory{"src/ref.ts": host})
      states, diagnostics := materializeClaimStates(anchoredGraph("", config), map[string]*artifactInventory{}, map[string]*artifactInventory{}, map[string]*artifactInventory{"api.json": inventory}, map[string]*artifactInventory{"src/ref.ts": host}, loader)
      diagnostics = append(diagnostics, evaluateEvidenceGraph(states, loader)...)
      messages := strings.Join(problemMessages(diagnostics), "\n")
      if source == "changed.json" {
        if !strings.Contains(messages, "Stale @evidenceReview for 'GET:/a'") {
          t.Errorf("changed effective server did not expire review: %s", messages)
        }
      } else if messages != "" {
        t.Errorf("equivalent contract must retain review: %s", messages)
      }
      if strings.Contains(messages, "for 'GET:/isolated'") || tokens[source]["GET:/isolated"] != tokens["original.json"]["GET:/isolated"] {
        t.Errorf("isolated sibling review changed: %s", messages)
      }
    })
  }
}
