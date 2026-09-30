package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a Prisma glob set is declared to the host as an external input.
 *
 * A `.prisma` file never enters the TypeScript Program, so the watch topology
 * and the editor server cannot learn the graph depends on one unless the rule
 * says so. The failure without this declaration is silent in the worst
 * direction: a developer editing code sees fresh diagnostics because the
 * TypeScript event drives a cycle that reloads the schema too, while a
 * developer editing only the schema keeps reading a green result for a citation
 * that has already gone stale.
 *
 *  1. Configure a Prisma claim and a Prisma reference.
 *  2. Collect the declared project inputs.
 *  3. Assert both glob sets are declared, and that an exclusion is not.
 *
 * @evidence contracts/testing.md#behavioral-verification graphProjectInputs includes both positive Prisma globs and omits legacy exclusions.
 * @evidence contracts/testing.md#independent-expectations Authored inclusion and negation patterns establish representable host dependencies.
 * @evidence contracts/testing.md#distinguishing-cases Claim/reference inputs are retained while exclusion-only patterns are not watched.
 * @evidence contracts/testing.md#execution-ownership TestPrismaGlobsAreDeclaredAsProjectInputs is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaGlobsAreDeclaredAsProjectInputs(t *testing.T) {
  config, problems := decodePrismaConfig(t, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/**/*.prisma","!prisma/schema/legacy/**"],
    "reference":{"type":"prisma","files":["other/**/*.prisma"]}
  }]}`)
  if len(problems) != 0 {
    t.Fatalf("the configuration must decode: %v", problems)
  }
  declared := []string{}
  for _, input := range graphProjectInputs(config) {
    declared = append(declared, string(input.Kind)+":"+input.Pattern)
  }
  joined := strings.Join(declared, "\n")
  for _, expected := range []string{
    "prisma/schema/**/*.prisma",
    "other/**/*.prisma",
  } {
    if !strings.Contains(joined, expected) {
      t.Fatalf("a configured Prisma glob must be watched, missing %q in:\n%s", expected, joined)
    }
  }
  // The host's dependency model has no negation, so an exclusion would ask it
  // to watch precisely the files this graph refuses to read.
  if strings.Contains(joined, "legacy") {
    t.Fatalf("an exclusion must not be declared:\n%s", joined)
  }
}
