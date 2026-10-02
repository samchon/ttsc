package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestSwaggerBridgeAnswersEverySourceInOneRequest shares one actual request
// across readable, rejected, unreadable and schema-dependent digest assertions.
//
// @evidence contracts/testing.md#behavioral-verification One normalizeSwaggerSources request returns exactly three documents and two problems for five unique source names. Six named assertion groups retain native digest agreement, mixed outcomes, missing identity, reached-schema change and unrelated-operation stability.
// @evidence contracts/testing.md#independent-expectations Original JSON bytes determine supported/rejected inputs and the absent path is never created. Literal POST:/members and POST:/sales keys must exist with nonempty digests on both original string/number variants before their moved/stable comparisons; native and Node hashing are separate implementations.
// @evidence contracts/testing.md#distinguishing-cases A readable success and readable unsupported version retain independent byte hashes; an unreadable source has no digest. Changing IMember.name must move only its reached operation, with ISale independently present as the stable control.
// @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeAnswersEverySourceInOneRequest is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
func TestSwaggerBridgeAnswersEverySourceInOneRequest(t *testing.T) {
  var root string
  var result swaggerNormalizationResult
  document := func(memberType string) string {
    return `{"openapi":"3.1.0","info":{"title":"A","version":"1"},"paths":{
      "/members":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/IMember"}}}},"responses":{"200":{"description":"OK"}}}},
      "/sales":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/ISale"}}}},"responses":{"200":{"description":"OK"}}}}
    },"components":{"schemas":{
      "IMember":{"type":"object","properties":{"name":{"type":"`+memberType+`"}},"required":["name"]},
      "ISale":{"type":"object","properties":{"price":{"type":"number"}},"required":["price"]}
    }}}`
  }
  ready := t.Run("normalizer_foundation", func(foundation *testing.T) {
    var err error
    root, err = parserBridgeBatchRoot(t, "loadSwaggerOperations.js")
    if err != nil {
      foundation.Errorf("prepare real normalizer fixture: %v", err)
      return
    }
    for source, content := range map[string]string{
      "swagger.json": `{"openapi":"3.1.0","info":{"title":"B","version":"1"},"paths":{"/members":{"post":{"responses":{"200":{"description":"OK"}}}}}}`,
      "broken.json": `{"openapi":"4.0.0","info":{"title":"B","version":"1"},"paths":{}}`,
      "before.json": document("string"),
      "after.json": document("number"),
    } {
      if err := os.WriteFile(filepath.Join(root, source), []byte(content), 0o644); err != nil {
        foundation.Errorf("write %s: %v", source, err)
      }
    }
    if foundation.Failed() {
      return
    }
    result, err = normalizeSwaggerSources(root, []string{"swagger.json", "broken.json", "absent.json", "before.json", "after.json"})
    if err != nil {
      foundation.Errorf("the bridge must run: %v", err)
    }
  })
  documents := map[string][]swaggerDocumentInventory{}
  problems := map[string][]swaggerDocumentProblem{}
  for _, value := range result.Documents {
    documents[value.Source] = append(documents[value.Source], value)
  }
  for _, value := range result.Problems {
    problems[value.Source] = append(problems[value.Source], value)
  }
  t.Run("complete_source_population", func(group *testing.T) {
    if !ready {
      group.Error("BLOCKED: normalizer foundation failed")
      return
    }
    if len(result.Documents) != 3 || len(result.Problems) != 2 {
      group.Errorf("want three documents and two problems, got %+v / %+v", result.Documents, result.Problems)
    }
    expected := map[string]bool{"swagger.json": true, "before.json": true, "after.json": true, "broken.json": false, "absent.json": false}
    for source, isDocument := range expected {
      if isDocument && (len(documents[source]) != 1 || len(problems[source]) != 0) ||
        !isDocument && (len(problems[source]) != 1 || len(documents[source]) != 0) {
        group.Errorf("%s must have exactly one %s outcome, got %d documents and %d problems", source, map[bool]string{true:"document", false:"problem"}[isDocument], len(documents[source]), len(problems[source]))
      }
    }
    for source := range documents {
      if _, exists := expected[source]; !exists {
        group.Errorf("unexpected document source %q", source)
      }
    }
    for source := range problems {
      if _, exists := expected[source]; !exists {
        group.Errorf("unexpected problem source %q", source)
      }
    }
  })
  valid := func(group *testing.T, source string) (swaggerDocumentInventory, bool) {
    group.Helper()
    if !ready {
      group.Error("BLOCKED: normalizer foundation failed")
      return swaggerDocumentInventory{}, false
    }
    if len(documents[source]) != 1 || len(problems[source]) != 0 {
      group.Errorf("%s must have exactly one document outcome", source)
      return swaggerDocumentInventory{}, false
    }
    return documents[source][0], true
  }
  rejected := func(group *testing.T, source string) (swaggerDocumentProblem, bool) {
    group.Helper()
    if !ready {
      group.Error("BLOCKED: normalizer foundation failed")
      return swaggerDocumentProblem{}, false
    }
    if len(problems[source]) != 1 || len(documents[source]) != 0 {
      group.Errorf("%s must have exactly one problem outcome", source)
      return swaggerDocumentProblem{}, false
    }
    return problems[source][0], true
  }
  t.Run("TestSwaggerBridgeReportsTheNativeDigest", func(group *testing.T) {
    value, ok := valid(group, "swagger.json")
    if !ok { return }
    native := swaggerContentDigest(root, "swagger.json")
    if native == "" { group.Error("the native side must hash a readable document") }
    if value.Digest != native { group.Errorf("bridge/native digest: %q / %q", value.Digest, native) }
  })
  t.Run("TestSwaggerBridgeReportsADigestForARejectedDocument", func(group *testing.T) {
    value, ok := rejected(group, "broken.json")
    if !ok { return }
    native := swaggerContentDigest(root, "broken.json")
    if value.Digest != native { group.Errorf("readable rejection bridge/native digest: %q / %q", value.Digest, native) }
  })
  t.Run("TestSwaggerBridgeReportsNoDigestForAnUnreadableDocument", func(group *testing.T) {
    value, ok := rejected(group, "absent.json")
    if !ok { return }
    if value.Digest != "" { group.Errorf("unread source digest: %q", value.Digest) }
    if swaggerContentDigest(root, "absent.json") != "" { group.Error("native hashing must decline the missing file") }
  })
  t.Run("TestSwaggerBridgeAnswersEverySourceInOneRequest", func(group *testing.T) {
    good, goodOK := valid(group, "swagger.json")
    bad, badOK := rejected(group, "broken.json")
    if goodOK && good.Digest != swaggerContentDigest(root, "swagger.json") { group.Error("valid source must carry its own bytes' digest") }
    if badOK && bad.Digest != swaggerContentDigest(root, "broken.json") { group.Error("rejected source must carry its own bytes' digest") }
    if badOK && strings.TrimSpace(bad.Message) == "" { group.Error("a rejection must carry its actionable reason") }
  })
  digests := func(group *testing.T, source string) (map[string]string, bool) {
    group.Helper()
    value, ok := valid(group, source)
    if !ok { return nil, false }
    out := map[string]string{}
    for _, operation := range value.Operations {
      key := strings.ToUpper(operation.Method)+":"+operation.Path
      if operation.Digest == "" { group.Errorf("%s %s carries no digest", operation.Method, operation.Path); ok = false }
      if _, exists := out[key]; exists { group.Errorf("duplicate operation %q", key); ok = false }
      out[key] = operation.Digest
    }
    for _, key := range []string{"POST:/members", "POST:/sales"} {
      if digest, exists := out[key]; !exists || digest == "" { group.Errorf("%s missing nonempty operation %s", source, key); ok = false }
    }
    return out, ok
  }
  for _, key := range []string{"POST:/members", "POST:/sales"} {
    t.Run("TestASwaggerOperationDigestFollowsTheSchemasItNames/"+key, func(group *testing.T) {
      before, beforeOK := digests(group, "before.json")
      after, afterOK := digests(group, "after.json")
      if !beforeOK || !afterOK { return }
      if key == "POST:/members" && before[key] == after[key] { group.Error("changing a reached schema left its operation digest unmoved") }
      if key == "POST:/sales" && before[key] != after[key] { group.Error("changing one schema moved an unrelated operation digest") }
    })
  }
}
