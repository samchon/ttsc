package evidence

import (
  "testing"
)

/**
 * Verifies every member kind can be selected explicitly.
 *
 * The default is a default, not a ceiling. A DTO field or a provider that
 * materializes one exact column should be able to cite that column, and the
 * only thing standing between a citation and its target is this selector —
 * an unselected member is not addressable at all.
 *
 *  1. Select all three kinds on a reference.
 *  2. Assert the selection decodes intact.
 *
 * @evidence contracts/testing.md#behavioral-verification decodePrismaConfig preserves explicit model,column,relation reference selection.
 * @evidence contracts/testing.md#independent-expectations The authored selector list supplies independent expected names.
 * @evidence contracts/testing.md#distinguishing-cases Explicit member selection contrasts with reference omission defaults.
 * @evidence contracts/testing.md#execution-ownership TestPrismaConfigurationSelectsMembersExplicitly is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaConfigurationSelectsMembersExplicitly(t *testing.T) {
  config, problems := decodePrismaConfig(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "reference":{
      "type":"prisma",
      "files":["prisma/**/*.prisma"],
      "symbol":["model","column","relation"]
    }
  }]}`)
  if len(problems) != 0 {
    t.Fatalf("an explicit member selection must decode: %v", problems)
  }
  if got := config.Claims[0].References[0].Symbols.names(); got != "model, column, relation" {
    t.Fatalf("selection: %q", got)
  }
}
