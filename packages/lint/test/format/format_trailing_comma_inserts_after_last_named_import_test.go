package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastNamedImport verifies named import
// lists get trailing commas on multiple lines.
//
// `import { a, b } from "x"` is the most common shape that benefits from
// trailing commas: every diff that adds an export has to touch one extra
// line otherwise. Mirroring the array/object behavior here is what makes
// the rule a real prettier substitute.
//
// 1. Parse a source file with one multi-line named import.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
func TestFormatTrailingCommaInsertsAfterLastNamedImport(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "import {\n  readFileSync,\n  writeFileSync\n} from \"node:fs\";\nreadFileSync; writeFileSync;\n",
    "import {\n  readFileSync,\n  writeFileSync,\n} from \"node:fs\";\nreadFileSync; writeFileSync;\n",
  )
}
