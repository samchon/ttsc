package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies Swagger configuration: exact local paths and HTTP(S) URLs decode as
 * separate reference-only operation populations.
 *
 * Swagger locations cannot pass through the glob decoder because URL query
 * strings and separators have different meaning there. Reading the decoded
 * model directly pins the singular locator contract, separate obligations, and
 * their internal operation selector.
 *
 *  1. Configure one TypeScript claim over local and remote Swagger references.
 *  2. Decode the public graph without loading either source.
 *  3. Assert normalized exact locations and the operation selector survive.
 */
func TestSwaggerConfigurationDecodesExactReferenceSources(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{
    "claims": [{
      "type": "typescript",
      "files": ["src/**"],
      "reference": [
        {"type": "swagger", "file": "api\\swagger.yaml"},
        {"type": "swagger", "file": "https://example.com/openapi.json?version=1"}
      ]
    }]
  }`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  references := config.Claims[0].References
  if len(references) != 2 {
    t.Fatalf("Swagger reference count = %d", len(references))
  }
  if references[0].Type != artifactSwagger || references[1].Type != artifactSwagger {
    t.Fatalf("reference types = %q, %q", references[0].Type, references[1].Type)
  }
  if references[0].Source != "api/swagger.yaml" ||
    references[1].Source != "https://example.com/openapi.json?version=1" {
    t.Fatalf("Swagger sources = %q, %q", references[0].Source, references[1].Source)
  }
  if got := references[0].Symbols.names(); got != "operation" {
    t.Fatalf("Swagger selector = %q", got)
  }
  if len(references[0].Files.Patterns) != 0 {
    t.Fatalf("Swagger source leaked into glob patterns: %+v", references[0].Files)
  }
}

/**
 * Verifies Swagger configuration failures: claims, selectors, plural globs,
 * directories, drive-relative paths, and unsupported URL schemes stay outside
 * the public contract.
 *
 * TypeScript prevents most of these shapes, but unchecked JavaScript config
 * still reaches the Go decoder. Every boundary needs an actionable runtime
 * failure so a malformed Swagger population cannot quietly become empty.
 *
 *  1. Decode one invalid graph for each Swagger-only boundary.
 *  2. Collect configuration diagnostics without touching the filesystem.
 *  3. Assert each diagnostic names the repair rather than a generic JSON error.
 */
func TestSwaggerConfigurationRejectsClaimAndLocatorViolations(t *testing.T) {
  cases := []struct {
    name string
    raw  string
    want string
  }{
    {
      name: "claim",
      raw: `{"claims":[{
        "type":"swagger",
        "files":["openapi.json"],
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "Swagger is evidence-only and cannot be a claim",
    },
    {
      name: "symbol",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "reference":{"type":"swagger","file":"openapi.json","symbol":"operation"}
      }]}`,
      want: "Swagger references select every operation",
    },
    {
      name: "plural files",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "reference":{"type":"swagger","files":["openapi.json"]}
      }]}`,
      want: "a Swagger reference owns one document",
    },
    {
      name: "directory",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "reference":{"type":"swagger","file":"../contracts/"}
      }]}`,
      want: "names a directory rather than a document",
    },
    {
      name: "drive relative",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "reference":{"type":"swagger","file":"C:openapi.json"}
      }]}`,
      want: "is drive-relative",
    },
    {
      name: "file URL",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "reference":{"type":"swagger","file":"file:///openapi.json"}
      }]}`,
      want: "only http: and https: are supported",
    },
    {
      name: "URL fragment",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "reference":{"type":"swagger","file":"https://example.com/openapi.json#paths"}
      }]}`,
      want: "must not contain a fragment",
    },
  }
  for _, entry := range cases {
    t.Run(entry.name, func(t *testing.T) {
      _, problems := decodeGraphConfig(json.RawMessage(entry.raw))
      if !strings.Contains(strings.Join(problemMessages(problems), "\n"), entry.want) {
        t.Fatalf("expected %q, got %v", entry.want, problems)
      }
    })
  }
}

/**
 * Verifies Swagger operation identity: method case is canonical while path
 * case, parameters, and trailing separators remain exact.
 *
 * The target is the only address a declaration carries. Normalizing the path
 * would silently redirect evidence between distinct OpenAPI operations, while
 * leaving method case unstable would make equivalent dialects disagree.
 *
 *  1. Materialize one mixed-case method and parameterized OpenAPI path.
 *  2. Inspect the resulting evidence unit.
 *  3. Assert its target is the whitespace-free canonical operation identity.
 */
func TestSwaggerOperationMaterializesCanonicalTarget(t *testing.T) {
  unit, problem := swaggerOperationUnit("api/openapi.yaml", swaggerOperation{
    Method: "post",
    Path:   "/Members/{memberId}/",
  })
  if problem != "" {
    t.Fatal(problem)
  }
  if unit.Target != "POST:/Members/{memberId}/" {
    t.Fatalf("operation target = %q", unit.Target)
  }
  if !strings.Contains(unit.Readable, "POST /Members/{memberId}/") {
    t.Fatalf("operation description = %q", unit.Readable)
  }
}

/**
 * Verifies Swagger target grammar: the operation form remains one token and
 * the pre-existing TypeScript symbol grammar is not reinterpreted.
 *
 * Treating `POST /members` as a two-token target would steal slash-prefixed
 * prose from a legitimate TypeScript symbol named `POST`. These adjacent cases
 * pin the backwards-compatible boundary.
 *
 *  1. Parse the safe `POST:/members` operation target.
 *  2. Parse the proposed two-token spelling beside it.
 *  3. Assert only the colon form belongs wholly to the target.
 */
func TestSwaggerTargetUsesOneTokenWithoutReinterpretingReasons(t *testing.T) {
  target, reason := splitDeclarationBody("POST:/members Creates a member.")
  if target != "POST:/members" || reason != "Creates a member." {
    t.Fatalf("colon declaration split into target %q and reason %q", target, reason)
  }
  target, reason = splitDeclarationBody("POST /members is slash-prefixed prose.")
  if target != "POST" || reason != "/members is slash-prefixed prose." {
    t.Fatalf("legacy declaration split into target %q and reason %q", target, reason)
  }
}

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
