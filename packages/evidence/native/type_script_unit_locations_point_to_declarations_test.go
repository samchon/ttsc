package evidence

import (
  "testing"
)

/**
 * Verifies TypeScript unit diagnostics point to declaration lines rather than
 * the beginning of leading trivia.
 *
 * AST node full starts may include blank lines and JSDoc. Those positions are
 * useful for comment attachment but misleading in an ambiguous-target or
 * missing-acknowledgement diagnostic that names the contract itself.
 *
 *  1. Put comments and blank lines before an interface and callable.
 *  2. Materialize type, property, and function units.
 *  3. Assert each unit records the line containing its declaration name.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert each unit records the line containing its declaration name.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations AST node full starts may include blank lines and JSDoc. Those positions are useful for comment attachment but misleading in an ambiguous-target or missing-acknowledgement diagnostic that names the contract itself. The authored scenario requires this outcome: Assert each unit records the line containing its declaration name.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put comments and blank lines before an interface and callable. Materialize type, property, and function units. Assert each unit records the line containing its declaration name.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptUnitLocationsPointToDeclarations runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptUnitLocationsPointToDeclarations(t *testing.T) {
  inventory := parseTypeScriptInventory(
    t,
    "src/contracts.ts",
    `// File preface.

/** Shape contract. */
export interface Shape {
  width: number;
}

/** Draw contract. */
export const draw = (): void => {};
`,
  )
  lines := map[string]int{}
  for _, unit := range inventory.Units {
    lines[unit.Target] = unit.Line
  }
  want := map[string]int{
    "Shape":       4,
    "Shape.width": 5,
    "draw":        9,
  }
  for target, expected := range want {
    if actual := lines[target]; actual != expected {
      t.Errorf("%s line = %d, want %d", target, actual, expected)
    }
  }
}
