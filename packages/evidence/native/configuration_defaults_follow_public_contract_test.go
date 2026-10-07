package evidence

import (
  "encoding/json"
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
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig returns the four literal artifact and role defaults.
 *
 * @evidence contracts/testing.md#independent-expectations The public Markdown claim/reference defaults are file and H1-H4; TypeScript claim defaults include type/function/property while reference defaults select type. The four literal strings independently distinguish artifact role and selector omission.
 *
 * @evidence contracts/testing.md#distinguishing-cases Markdown claim/reference defaults contrast TypeScript claim and reference defaults.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationDefaultsFollowPublicContract is a Go unit entry in the native test process; it calls decodeGraphConfig on one in-memory JSON string with no filesystem, package installation, artifact build or product host, and has a single case with no table.
 */
func TestEvidenceSemanticConfigurationDefaultsFollowPublicContract(t *testing.T) {
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
