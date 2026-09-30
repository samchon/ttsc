package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a model the scan could not locate reaches every population of the set.
 *
 * The locator is subordinate to the parser: it answers where a name is written
 * and never what exists, so a file it cannot read costs precise lines and no
 * obligations. That held while a set belonged to one population, because every
 * file of the set answered the same globs. A set now spans populations whose
 * roots spell its files differently, and filing such a unit under the first
 * source's spelling alone would hand it to that population and drop it from the
 * others with nothing said; the silent shortfall this campaign exists to
 * remove. The state is reached whenever a file the digest read a moment earlier
 * cannot be read again, which one Windows lock is enough to do.
 *
 *  1. Compose a set of two files under two roots, neither present to be read.
 *  2. Give the outcome a model, so the scan can locate nothing at all.
 *  3. Assert both populations carry it, addressed by the one location there is.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaUnitsFromOutcome is exercised with the scenario below; the assertions require both populations carry it, addressed by the one location there is.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The locator is subordinate to the parser: it answers where a name is written and never what exists, so a file it cannot read costs precise lines and no obligations. That held while a set belonged to one population, because every file of the set answered the same globs. A set now spans populations whose roots spell its files differently, and filing such a unit under the first source's spelling alone would hand it to that population and drop it from the others with nothing said; the silent shortfall this campaign exists to remove. The state is reached whenever a file the digest read a moment earlier cannot be read again, which one Windows lock is enough to do.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Compose a set of two files under two roots, neither present to be read. Give the outcome a model, so the scan can locate nothing at all. Assert both populations carry it, addressed by the one location there is.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAModelTheScanCouldNotLocateReachesEveryPopulationOfTheSet is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestAModelTheScanCouldNotLocateReachesEveryPopulationOfTheSet(t *testing.T) {
  set := prismaSourceSet{
    Sources: []string{"alpha/main.prisma", "beta/main.prisma"},
    Spellings: map[string][]string{
      "alpha/main.prisma": {"alpha/main.prisma"},
      "beta/main.prisma":  {"beta/main.prisma"},
    },
  }
  inventories := map[string]*artifactInventory{
    "alpha": {Path: "alpha/main.prisma", Type: artifactPrisma},
    "beta":  {Path: "beta/main.prisma", Type: artifactPrisma},
  }
  problems := prismaUnitsFromOutcome(t.TempDir(), set, inventories, prismaSetOutcome{
    Models: []prismaModel{{
      Name:   "sale",
      Digest: "model-digest",
      Fields: []prismaField{{Name: "id", Symbol: "column", Digest: "field-digest"}},
    }},
  }, graphConfig{})
  if len(problems) != 0 {
    t.Fatalf("an unlocated model is not a problem, got %v", problems)
  }
  for _, population := range []string{"alpha", "beta"} {
    units := []string{}
    for _, unit := range inventories[population].Units {
      units = append(units, unit.ID+"@"+unit.location())
    }
    // The location is the set's first source either way, because it is the one
    // path this rule can name and it opens. What must not depend on it is which
    // populations owe the model.
    if strings.Join(units, ",") != "prisma:sale@alpha/main.prisma,prisma:sale.id@alpha/main.prisma" {
      t.Fatalf("population '%s' carries %v; an unlocated model belongs to the whole set", population, units)
    }
  }
}
