package linthost

import "testing"

// TestFixNoUselessRenameDropsRenameTail verifies the noUselessRename
// fixer collapses `{ x as x }` to `{ x }` on an import specifier.
//
// The rule fires on three syntactic shapes (import/export specifier and
// binding element); they share one helper that deletes the rename tail.
// Each syntax is exercised so a shared helper cannot hide a disconnected
// export or binding-element visitor.
//
// 1. Parse an import declaration with a redundant rename.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the rename tail is gone.
//
// @evidence contracts/testing.md#behavioral-verification no-useless-rename removes redundant import/export aliases and a destructuring rename while preserving the surrounding source.
// @evidence contracts/testing.md#independent-expectations Literal import { foo }, export { foo } and binding { foo } results follow equal source/local identity, preserving module and initializer text.
// @evidence contracts/testing.md#distinguishing-cases Import, export and binding syntax each reach the shared fix; an unequal identifier alias stays silent, alongside the separate string-literal alias control.
// @evidence contracts/testing.md#execution-ownership TestFixNoUselessRenameDropsRenameTail calls assertFixSnapshot for no-useless-rename with real Engine and disk edit application.
func TestFixNoUselessRenameDropsRenameTail(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-useless-rename",
    "import { foo as foo } from \"./fixture\";\nJSON.stringify(foo);\n",
    "import { foo } from \"./fixture\";\nJSON.stringify(foo);\n",
  )
  assertFixSnapshot(t, "no-useless-rename",
    "const foo = 1;\nexport { foo as foo };\n",
    "const foo = 1;\nexport { foo };\n",
  )
  assertFixSnapshot(t, "no-useless-rename",
    "const input = { foo: 1 };\nconst { foo: foo } = input;\nJSON.stringify(foo);\n",
    "const input = { foo: 1 };\nconst { foo } = input;\nJSON.stringify(foo);\n",
  )
  assertRuleSkipsSource(t, "no-useless-rename",
    "import { foo as bar } from \"./fixture\";\nJSON.stringify(bar);\n",
  )
}
