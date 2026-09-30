package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies TypeScript accepts a disk population root while Swagger owns a file.
 *
 * Rooted TypeScript references explicitly load an external code population.
 * Swagger continues to carry its location in its singular file property.
 *
 *  1. Declare `root` on TypeScript and Swagger references.
 *  2. Decode each configuration.
 *  3. Assert TypeScript accepts the root and Swagger names its file repair.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification decodeGraphConfig accepts TypeScript root and reports Swagger's file-channel repair.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The two literal artifact types have different supported locator channels.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases TypeScript root is legal while Swagger requires singular file.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptRootsAndSwaggerFilesKeepTheirSelectionChannels is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestTypeScriptRootsAndSwaggerFilesKeepTheirSelectionChannels(t *testing.T) {
  _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"typescript",
      "root":"../shared",
      "files":["src/**"]
    }
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("a TypeScript reference root must select an explicit disk population, got %v", problems)
  }

  _, problems = decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"swagger","root":"../contracts","file":"swagger.json"}
  }]}`))
  if !strings.Contains(strings.Join(problems, "\n"), "write the ancestor-relative or absolute location in 'file'") {
    t.Fatalf("a Swagger root must name the file channel, got %v", problems)
  }
}
