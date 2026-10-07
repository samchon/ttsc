package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies the same correction in a declaration file.
 *
 * A published SDK ships its accessors as `.d.ts`, where nothing carries an
 * export modifier of the kind a source file uses and namespace members are
 * implicitly public instead. That is a different path to the same population,
 * so it needs its own case, a correction that held only for `.ts` would leave
 * every consumer selecting an installed package exactly where they started.
 *
 *  1. Declare the accessor ambiently with `declare function` and
 *     `declare namespace`.
 *  2. Collect the inventory.
 *  3. Assert the accessor and its namespace identity survive and nothing else
 *     does.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the accessor and its namespace identity survive and nothing else does.
 * @evidence contracts/testing.md#independent-expectations A published SDK ships its accessors as `.d.ts`, where nothing carries an export modifier of the kind a source file uses and namespace members are implicitly public instead. That is a different path to the same population, so it needs its own case, a correction that held only for `.ts` would leave every consumer selecting an installed package exactly where they started. The authored scenario requires this outcome: Assert the accessor and its namespace identity survive and nothing else does.
 * @evidence contracts/testing.md#distinguishing-cases Declare the accessor ambiently with `declare function` and `declare namespace`. Collect the inventory. Assert the accessor and its namespace identity survive and nothing else does.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptFunctionMergedNamespaceIsDroppedInDeclarationFiles runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptFunctionMergedNamespaceIsDroppedInDeclarationFiles(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.d.ts", `
export declare function get(connection: string): string;
export declare namespace get {
  const path: () => string;
  type Output = string;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:get",
    "type:get",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "ambient merged namespace units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
