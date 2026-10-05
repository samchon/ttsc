package evidence

import (
  "testing"
)

// variableDigestOf reports one variable unit's digest from a single file.
func variableDigestOf(t *testing.T, target string, content string) string {
  t.Helper()
  inventory := parseTypeScriptInventory(t, "src/rates.ts", content)
  for _, unit := range inventory.Units {
    if unit.Target == target {
      return unit.Digest
    }
  }
  t.Fatalf("expected a unit for %s in:\n%s", target, content)
  return ""
}

// innerDeclaratorReviewConfig cites a variable through a TypeScript reference
// that requires a review, which is the only arrangement where the review and
// the unit it fingerprints can share a file.
const innerDeclaratorReviewConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/claim/**"],
  "symbol":"type",
  "reference":{
    "type":"typescript",
    "files":["src/spec/**"],
    "symbol":"property",
    "requireReview":true
  }
}]}`

// bothSiblingsCited cites each declarator of one statement, so a diagnostic
// naming one of them is a statement about that identity alone.
func bothSiblingsCited(alpha string, beta string) string {
  return `import { alpha, beta } from "../spec/rates";

/**
 * @evidence {@link alpha} Mirrors the published floor.
 * @evidenceReview {@link alpha} #` + alpha + ` The floor matches the published one.
 * @evidence {@link beta} Mirrors the published rate.
 * @evidenceReview {@link beta} #` + beta + ` The rate matches the published one.
 */
export interface IView {
  floor: number;
  rate: number;
}
`
}

// bothSiblingsUncited is the same citation set with the reviews removed, which
// is what makes the graph name the fingerprint it expects for each target.
const bothSiblingsUncited = `import { alpha, beta } from "../spec/rates";

/**
 * @evidence {@link alpha} Mirrors the published floor.
 * @evidence {@link beta} Mirrors the published rate.
 */
export interface IView {
  floor: number;
  rate: number;
}
`
