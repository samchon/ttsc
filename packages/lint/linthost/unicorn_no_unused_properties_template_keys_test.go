package linthost

import "testing"

// TestUnicornNoUnusedPropertiesTemplateKeys verifies that template literals
// differ from plain string keys in the two authored non-substitution cases.
//
// The template index is expected to preserve both properties. The computed
// template key is expected to report with its backtick source text, while
// the ordinary used sibling remains clean. Treating these templates as plain
// strings would change the independently authored marker set.
//
//  1. Access one object through a template index, and give another object a
//     template computed key beside a plain used property.
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert only the template-keyed property reports, with backticks
//     preserved in its message.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed engine compares the exact authored property-name/line set, exposing template indexes treated as static strings or computed template keys given invented names.
// @evidence contracts/testing.md#independent-expectations Independent source markers deliberately distinguish the authored template index and computed template key from plain string-key expectations; no expected name is extracted by the production matcher.
// @evidence contracts/testing.md#distinguishing-cases A template index makes the object access unpredictable and preserves all properties; a template computed key reports its raw backtick display name while ordinary used siblings remain clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnusedPropertiesTemplateKeys owns this authored checker-source matrix as a discoverable Go unit entry. loadProgram and the lint cycle operate in the shared Go process on t.TempDir fixtures; no native build, installed consumer or real child product host runs.
func TestUnicornNoUnusedPropertiesTemplateKeys(t *testing.T) {
  tick := "`"
  source := `export {};
declare function consume(...values: unknown[]): void;

const templateIndex = { plain: "a", alsoPlain: "b" };
consume(templateIndex[` + tick + `plain` + tick + `]);

const templateKey = { /* unused:` + tick + `literal` + tick + ` */ [` + tick + `literal` + tick + `]: "a", spare: "b" };
consume(templateKey.literal, templateKey.spare);
`
  assertUnusedPropertiesFindings(t, source)
}
