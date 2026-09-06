package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies configuration defaults: each artifact role receives the symbol set
 * documented by the public TypeScript interfaces.
 *
 * Defaults differ by both artifact and role. Reusing one generic fallback would
 * silently turn TypeScript functions into evidence units or silently reject
 * valid claim hosts, so this test reads the decoded model directly.
 *
 *  1. Omit every claim and reference symbol selector.
 *  2. Decode one Markdown claim and one TypeScript claim.
 *  3. Assert the four documented default sets independently.
 */
func TestConfigurationDefaultsFollowPublicContract(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{
    "claims": [
      {
        "type": "markdown",
        "files": ["docs/**"],
        "reference": {"type": "markdown", "files": ["spec/**"]}
      },
      {
        "type": "typescript",
        "files": ["src/**"],
        "reference": {"type": "typescript", "files": ["lib/**"]}
      }
    ]
  }`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  if got := config.Claims[0].Symbols.names(); got != "file, h1, h2, h3, h4" {
    t.Fatalf("Markdown claim host default = %q", got)
  }
  if got := config.Claims[0].References[0].Symbols.names(); got != "file, h1, h2, h3, h4" {
    t.Fatalf("Markdown reference unit default = %q", got)
  }
  if got := config.Claims[1].Symbols.names(); got != "type, function, property" {
    t.Fatalf("TypeScript claim host default = %q", got)
  }
  if got := config.Claims[1].References[0].Symbols.names(); got != "type" {
    t.Fatalf("TypeScript reference unit default = %q", got)
  }
}

/**
 * Verifies singular-or-array configuration: symbol arrays form a union while
 * reference arrays remain independently indexed obligations.
 *
 * The two array shapes look alike in JSON but carry opposite graph semantics.
 * Pinning the decoded shape prevents a refactor from flattening reference
 * obligations into one pooled evidence set.
 *
 *  1. Configure one symbol string, one symbol array, and two references.
 *  2. Decode the public configuration.
 *  3. Assert symbol union and reference boundaries survive.
 */
func TestConfigurationKeepsSymbolUnionAndReferencesDistinct(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{
    "claims": [{
      "type": "typescript",
      "files": ["src/**"],
      "symbol": ["function", "property"],
      "reference": [
        {"type": "markdown", "files": ["docs/a/**"], "symbol": "h2"},
        {"type": "markdown", "files": ["docs/b/**"], "symbol": ["file", "h1"]}
      ]
    }]
  }`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  claim := config.Claims[0]
  if got := claim.Symbols.names(); got != "function, property" {
    t.Fatalf("symbol array did not form one union: %q", got)
  }
  if len(claim.References) != 2 {
    t.Fatalf("reference array collapsed to %d obligation(s)", len(claim.References))
  }
  if claim.References[0].Symbols.names() != "h2" ||
    claim.References[1].Symbols.names() != "file, h1" {
    t.Fatalf("reference selectors crossed obligation boundaries: %+v", claim.References)
  }
}

/**
 * Verifies invalid configuration diagnostics: invalid nested severity and
 * empty obligation arrays fail before graph evaluation.
 *
 * The public contract validates nested severity and requires a real evidence
 * population. Invalid levels and vacuous arrays must fail at configuration.
 *
 *  1. Decode a claim with nested severity and an empty reference array.
 *  2. Decode an empty claim array separately.
 *  3. Assert every failure names the public repair boundary.
 */
func TestConfigurationRejectsObsoleteAndVacuousShapes(t *testing.T) {
  _, problems := decodeGraphConfig(json.RawMessage(`{
    "claims": [{
      "type": "typescript",
      "files": ["src/**"],
      "severity": "fatal",
      "reference": []
    }]
  }`))
  joined := strings.Join(problems, "\n")
  if !strings.Contains(joined, "claims[0].severity") {
    t.Fatalf("invalid severity was not rejected: %s", joined)
  }
  if !strings.Contains(joined, "empty reference array") {
    t.Fatalf("empty references were not rejected: %s", joined)
  }

  _, problems = decodeGraphConfig(json.RawMessage(`{"claims":[]}`))
  if !strings.Contains(strings.Join(problems, "\n"), "at least one claim") {
    t.Fatalf("empty claims were not rejected: %v", problems)
  }
}

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
 */
func TestConfigurationRejectsMalformedPublicBoundaries(t *testing.T) {
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
