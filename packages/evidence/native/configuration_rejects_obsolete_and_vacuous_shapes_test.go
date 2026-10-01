package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

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
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig reports each literal nested severity and empty obligation failure.
 *
 * @evidence contracts/testing.md#independent-expectations The public lint severity values exclude fatal and the graph requires a non-empty claim and reference population. Literal severity-path, empty-reference, and empty-claims findings detect silent acceptance of invalid configuration.
 *
 * @evidence contracts/testing.md#distinguishing-cases Invalid nested severity and empty reference arrays contrast an independently empty claims array.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationRejectsObsoleteAndVacuousShapes is a Go unit entry in the native test process; it calls decodeGraphConfig on two in-memory JSON strings with no filesystem, package installation, artifact build or product host, and has no table of variants.
 */
func TestEvidenceSemanticConfigurationRejectsObsoleteAndVacuousShapes(t *testing.T) {
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
