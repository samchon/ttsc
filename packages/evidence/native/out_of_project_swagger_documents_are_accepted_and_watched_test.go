package evidence

import (
  "encoding/json"
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
)

/**
 * Verifies a local Swagger document outside the project is accepted and still
 * declared as a watched file.
 *
 * The rule already accepts an arbitrary http(s) URL on any host, so refusing
 * `../contracts/swagger.json` refused the one form an author can pin, version,
 * and diff. Publishing it is what keeps the escape honest: an OpenAPI document
 * regenerated in a sibling package has a filesystem event, and withholding it
 * would trade a compile error for a silently stale one.
 *
 *  1. Configure ancestor-relative and absolute Swagger references.
 *  2. Decode them and publish the rule's project inputs.
 *  3. Assert both normalize as written and arrive as exact file dependencies.
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig decodes a claim with an ancestor-relative and a drive-absolute Swagger file and must report no problem and keep both sources exactly as written; normalizeSwaggerSource is called on four directory spellings; graphRule.ProjectInputs (through declaredInputs) must publish both files as file inputs.
 * @evidence contracts/testing.md#independent-expectations The expected sources and the exact published file patterns are authored literals ("../contracts/swagger.json", "C:/shared/contracts/openapi.yaml"), and the directory spellings ("C:/", "/", "../contracts/", "..") are authored as things that cannot name a document, none computed by the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Two out-of-project file spellings must be accepted and watched, while four directory spellings must each be refused by normalizeSwaggerSource; the body has no in-project positive case, and an http(s) URL source is not exercised.
 * @evidence contracts/testing.md#execution-ownership TestOutOfProjectSwaggerDocumentsAreAcceptedAndWatched is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestOutOfProjectSwaggerDocumentsAreAcceptedAndWatched(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"swagger","file":"../contracts/swagger.json"},
      {"type":"swagger","file":"C:/shared/contracts/openapi.yaml"}
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("an out-of-project Swagger document must decode, got %v", problems)
  }
  sources := []string{
    config.Claims[0].References[0].Source,
    config.Claims[0].References[1].Source,
  }
  if sources[0] != "../contracts/swagger.json" ||
    sources[1] != "C:/shared/contracts/openapi.yaml" {
    t.Fatalf("Swagger sources = %v", sources)
  }
  // A drive root and a bare separator name directories, and both survive
  // `path.Clean` looking like ordinary paths. Reporting them as missing
  // documents would send the author to generate a file at a location that
  // cannot hold one.
  for _, directory := range []string{"C:/", "/", "../contracts/", ".."} {
    if _, problem := normalizeSwaggerSource(directory); problem == "" {
      t.Fatalf("Swagger source %q was accepted as a document", directory)
    }
  }
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"swagger","file":"../contracts/swagger.json"},
      {"type":"swagger","file":"C:/shared/contracts/openapi.yaml"}
    ]
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputFile, sources)
}
