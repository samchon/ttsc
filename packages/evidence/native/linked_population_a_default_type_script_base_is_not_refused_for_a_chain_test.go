package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestADefaultTypeScriptBaseIsNotRefusedForAChain verifies the implicit TypeScript base is exempt from declared-root checks.
//
// The default base spells the Program source identity and declares no root property.
// The graph still validates the project identity before any population; that prerequisite may reject a chain the native filesystem cannot traverse.
//
//  1. Build an overlong native chain and directly check the default-base gate.
//  2. If native Stat refuses, execute and assert the real project-identity failure.
//  3. Otherwise execute the authored TypeScript graph and require its ISpec obligation without root refusal.
//
// @evidence contracts/testing.md#behavioral-verification typeScriptBaseProblems always exempts the implicit TypeScript base from bounded resolution; graphRule.Check reports a native-inaccessible project identity, while a native-readable chain retains the original ISpec acknowledgement obligation.
// @evidence contracts/testing.md#independent-expectations The default-base contract independently requires no declared-root problem. Actual native Stat selects the graph prerequisite; authored ISpec and project-identity diagnostic literals distinguish its two reachable results.
// @evidence contracts/testing.md#distinguishing-cases No explicit root is declared. The direct gate assertion survives even when native traversal prevents graph materialization; native-readable hosts retain the complete original coverage assertion.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestADefaultTypeScriptBaseIsNotRefusedForAChain(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  real := filepath.Join(workspace, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := real
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/sale.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/spec.ts"],"symbol":"type"}
  }]}`
  decoded := decodeInventoryConfig(t, previous, config)
  if problems := typeScriptBaseProblems(claimPopulationConfig(decoded, artifactTypeScript), map[string]*artifactInventory{}); len(problems) != 0 {
    t.Fatalf("an implicit TypeScript base must not be treated as a declared root: %v", problems)
  }
  if _, err := os.Stat(previous); err != nil {
    assertUnreachableLinkedProject(t, previous, config)
    return
  }
  messages := runIndexRuleAtRoot(t, previous, map[string]string{
    "src/sale.ts": "export interface ISale {}\n",
    "src/spec.ts": "export interface ISpec {}\n",
  }, config)
  if len(messages) == 0 {
    logLinkedPopulationPaths(t, previous)
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'ISpec'")
  if countProblemsContaining(messages, "found no directory at the end of") != 0 {
    t.Fatalf(
      "the base a Program spells its sources against owes no resolution:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
