//go:build e2e

package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an operation's digest reaches the schemas it names.
 *
 * The converter preserves `$ref`s rather than inlining them, so an operation is
 * often no more than the name of a contract where its request and response
 * bodies belong. A digest over the operation as written therefore covered the
 * name and not the contract, and changing every property of a DTO expired no
 * review of the endpoint that carries it. That is the failure this feature
 * exists to remove, reproduced on the other bridge.
 *
 * The unchanged sibling is the negative twin. Resolving references must not
 * make one document-wide value out of them, which is the mass false-expiry the
 * whole-source digest would have produced.
 *
 *  1. Normalize a document whose two operations reference one schema each.
 *  2. Change one referenced schema's property type.
 *  3. Assert that operation's digest moved and the other's did not.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizeSwaggerSources parses two documents through the installed Swagger bridge; changing IMember.name must change POST:/members while POST:/sales stays equal, with a nonempty check on each returned operation.
 * @evidence contracts/testing.md#independent-expectations An operation digest follows only schemas it reaches, so an unrelated ISale operation is the stable control. Relative changes do not establish an exact digest oracle.
 * @evidence contracts/testing.md#distinguishing-cases String-to-number schema mutation challenges reached-schema tracking and compares an unrelated operation. The map comparisons do not separately require both operation keys to exist, so missing unchanged sales entries would remain indistinguishable.
 * @evidence contracts/testing.md#execution-ownership TestASwaggerOperationDigestFollowsTheSchemasItNames is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizeSwaggerSources twice (one Node child per document). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizeSwaggerSources executes the installed @ttsc/evidence Swagger loader in Node and returns schema-dependent operation digests to Go. The unrelated-operation control detects overbroad dependency propagation across that connection.
 * @evidence contracts/e2e.md#shared-execution the digests closure is called twice (string then number member type), so the test starts 2 Node child processes; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity swaggerBridgeRoot creates and cleans a distinct absolute fixture root for each document. Result maps stay local to this entry, and each returned operation is checked for a nonempty digest before comparison; process-count or cache-reuse correctness is not asserted.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts non-empty operation digests (L53), a moved POST:/members digest when IMember.name changes type (L62) and an unmoved POST:/sales digest (L68).
 */
func TestASwaggerOperationDigestFollowsTheSchemasItNames(t *testing.T) {
  digests := func(memberType string) map[string]string {
    root := swaggerBridgeRoot(t, `{"openapi":"3.1.0","info":{"title":"A","version":"1"},"paths":{
      "/members":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/IMember"}}}},"responses":{"200":{"description":"OK"}}}},
      "/sales":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/ISale"}}}},"responses":{"200":{"description":"OK"}}}}
    },"components":{"schemas":{
      "IMember":{"type":"object","properties":{"name":{"type":"`+memberType+`"}},"required":["name"]},
      "ISale":{"type":"object","properties":{"price":{"type":"number"}},"required":["price"]}
    }}}`)
    result, err := normalizeSwaggerSources(root, []string{"swagger.json"})
    if err != nil {
      t.Fatalf("the bridge must run: %v", err)
    }
    if len(result.Documents) != 1 {
      t.Fatalf("expected one normalized document, got %d (%v)", len(result.Documents), result.Problems)
    }
    out := map[string]string{}
    for _, operation := range result.Documents[0].Operations {
      if operation.Digest == "" {
        t.Fatalf("%s %s carries no digest", operation.Method, operation.Path)
      }
      out[strings.ToUpper(operation.Method)+":"+operation.Path] = operation.Digest
    }
    return out
  }
  before := digests("string")
  after := digests("number")
  if before["POST:/members"] == after["POST:/members"] {
    t.Fatalf(
      "changing a referenced schema left the operation's digest unmoved (%s), so a review of the endpoint survives its contract changing",
      before["POST:/members"],
    )
  }
  if before["POST:/sales"] != after["POST:/sales"] {
    t.Fatalf(
      "changing one schema moved an unrelated operation's digest (%s to %s), which is the document-wide expiry this replaces",
      before["POST:/sales"],
      after["POST:/sales"],
    )
  }
}
