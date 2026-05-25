package linthost

import "testing"

// TestFixNoUselessRenameDropsRenameTail verifies the noUselessRename
// fixer collapses `{ x as x }` to `{ x }` on an import specifier.
//
// The rule fires on three syntactic shapes (import/export specifier and
// binding element); they share one helper that deletes the rename tail.
// Pinning the import case is enough for fix-snapshot coverage because the
// other two reach the same helper through identical accessors.
//
// 1. Parse an import declaration with a redundant rename.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the rename tail is gone.
func TestFixNoUselessRenameDropsRenameTail(t *testing.T) {
  assertFixSnapshot(
    t,
    "noUselessRename",
    "import { foo as foo } from \"./fixture\";\nJSON.stringify(foo);\n",
    "import { foo } from \"./fixture\";\nJSON.stringify(foo);\n",
  )
}
