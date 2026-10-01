package linthost

import "testing"

// TestFormatBracketSpacingPadsNamedImports verifies bracketSpacing:true pads
// a single-line named import's braces.
//
//  1. Parse `import {foo, bar} from "m"`.
//  2. Apply format/bracket-spacing with spacing:true.
//  3. Assert it becomes `import { foo, bar } from "m"`.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must pad the braces around a single-line named import without changing its imported names or module specifier.
// @evidence contracts/testing.md#independent-expectations The complete literal output retains foo, bar and module m and adds exactly one space at each brace interior according to spacing:true.
// @evidence contracts/testing.md#distinguishing-cases This NamedImports positive complements the ImportAttributes positive with its different brace location, and already-padded object/type negatives own abstention under the same spacing option.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingPadsNamedImports is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingPadsNamedImports(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "import {foo, bar} from \"m\";\n",
    `{"spacing":true}`,
    "import { foo, bar } from \"m\";\n",
  )
}
