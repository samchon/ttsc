package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastNamedImport verifies named import
// lists get trailing commas on multiple lines.
//
// A named import comma belongs inside its specifier list. The module string and the imported bindings must stay unchanged.
//
// 1. Parse a source file with one multi-line named import.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The named import list must gain only a comma after writeFileSync while retaining readFileSync, node:fs and both subsequent uses.
// @evidence contracts/testing.md#independent-expectations Prettier applies terminal commas to broken named import specifiers. The literal complete output independently preserves imported binding order and module identity.
// @evidence contracts/testing.md#distinguishing-cases This named-import positive differs from named exports and combined/default import reflow. Inline and canonical negatives distinguish insertion eligibility.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastNamedImport owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastNamedImport(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "import {\n  readFileSync,\n  writeFileSync\n} from \"node:fs\";\nreadFileSync; writeFileSync;\n",
    "import {\n  readFileSync,\n  writeFileSync,\n} from \"node:fs\";\nreadFileSync; writeFileSync;\n",
  )
}
