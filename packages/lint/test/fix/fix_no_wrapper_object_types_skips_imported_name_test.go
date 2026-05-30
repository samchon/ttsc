package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsImportedName verifies the shadow bailout
// also covers an imported wrapper name.
//
// Before this repair the shadow guard only checked file-scope
// `type`/`interface`/`class` declarations, so `import { String } from "./m"`
// left the binding invisible: the rule fired on the `String` reference and
// the fix rewrote it to the global `string` primitive — silently retargeting
// the annotation to a different type. The repair extends the guard to import
// bindings (default, namespace, named — incl. aliased) and top-level
// value/enum declarations, bailing to detection-only when one is present.
//
//  1. Parse a file that imports `String` and annotates with it.
//  2. Run the rule under the engine and confirm zero findings.
//  3. The imported `String` annotation survives byte-for-byte.
func TestFixNoWrapperObjectTypesSkipsImportedName(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-wrapper-object-types",
    "import { String } from \"./m\";\nconst x: String = \"\" as unknown as String;\nJSON.stringify(x);\n",
  )
}
