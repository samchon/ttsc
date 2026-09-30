package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

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
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification decodeGraphConfig reports each invalid table row's literal repair.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Authored bad configurations independently identify prohibited channels.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases All table rows retain distinct failure messages under this entry.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerConfigurationRejectsClaimAndLocatorViolations is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
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
