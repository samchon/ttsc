package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies malformed runtime JSON cannot slip past the stricter public
 * configuration boundary.
 *
 * TypeScript catches these shapes for typed consumers, but lint configuration
 * is runtime input and may be JavaScript, generated JSON, or an unchecked cast.
 * Every required discriminator and non-empty selector therefore needs its own
 * actionable decoder failure.
 *
 *  1. Exercise missing, unknown, unsupported, empty, superseded, and
 *     absolute-path shapes.
 *  2. Decode each shape without graph evaluation.
 *  3. Assert the diagnostic names the violated public boundary.
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig is called on the raw inputs of twelve t.Run rows (empty options, a non-object root, an unsupported artifact type, missing files, empty files, exclusion-only files, an absolute files pattern, an empty symbol array, a missing reference, the superseded `sources` root, the superseded `citedBy` property and an unknown claim property), and each row's joined problems must contain its literal repair fragment.
 * @evidence contracts/testing.md#independent-expectations Each row's expected fragment is an authored literal from the public configuration contract (discriminators, positive relative file globs, non-empty selectors, claim-side relations); none is computed from the decoder.
 * @evidence contracts/testing.md#distinguishing-cases Each malformed shape is its own t.Run row, so a decoder that accepts or mislabels one shape fails that row alone; a claim with a missing `type` discriminator is not one of the rows, and only containment of the fragment (not exclusivity) is asserted.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationRejectsMalformedPublicBoundaries is a Go unit entry in the native test process that owns twelve t.Run rows; each calls decodeGraphConfig on an in-memory JSON string with no filesystem, package installation, artifact build or product host.
 */
func TestEvidenceSemanticConfigurationRejectsMalformedPublicBoundaries(t *testing.T) {
  cases := []struct {
    name string
    raw  string
    want string
  }{
    {
      name: "missing options",
      raw:  "",
      want: "requires an ITtscEvidenceGraphConfig options object",
    },
    {
      name: "non-object root",
      raw:  "[]",
      want: "configuration: expected an object",
    },
    {
      // Re-pointed from `prisma`, which this graph now supports. The case
      // exists to pin that an unknown discriminator is named back to its
      // author rather than silently ignored, so it needs a kind the graph
      // does not have — not whichever one it happened to lack when the
      // case was written.
      name: "unsupported discriminator",
      raw: `{"claims":[{
        "type":"graphql",
        "files":["schema.graphql"],
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "unsupported artifact type 'graphql'",
    },
    {
      name: "missing files",
      raw: `{"claims":[{
        "type":"typescript",
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "required project-relative glob array is missing",
    },
    {
      name: "empty files",
      raw: `{"claims":[{
        "type":"typescript",
        "files":[],
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "at least one positive glob is required",
    },
    {
      name: "exclusions only",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["!src/private/**"],
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "files array must contain at least one positive glob",
    },
    {
      name: "absolute files",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["/src/index.ts"],
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "every files pattern must be project-relative",
    },
    {
      name: "empty symbols",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "symbol":[],
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "empty symbol array selects no evidence units",
    },
    {
      name: "missing reference",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"]
      }]}`,
      want: "required evidence reference is missing",
    },
    {
      name: "superseded sources root",
      raw: `{"sources":[{
        "type":"markdown",
        "files":["docs/**"],
        "citedBy":{"type":"typescript","files":["src/**"]}
      }]}`,
      want: "declared from the claiming side; declare 'claims'",
    },
    {
      name: "superseded citedBy property",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "citedBy":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "this relation was inverted; declare the evidence this claim cites under 'reference'",
    },
    {
      name: "unknown claim property",
      raw: `{"claims":[{
        "type":"typescript",
        "files":["src/**"],
        "documents":["legacy"],
        "reference":{"type":"markdown","files":["docs/**"]}
      }]}`,
      want: "claims[0].documents: unknown property",
    },
  }
  for _, entry := range cases {
    t.Run(entry.name, func(t *testing.T) {
      _, problems := decodeGraphConfig(json.RawMessage(entry.raw))
      if !strings.Contains(strings.Join(problems, "\n"), entry.want) {
        t.Fatalf("expected %q, got %v", entry.want, problems)
      }
    })
  }
}
