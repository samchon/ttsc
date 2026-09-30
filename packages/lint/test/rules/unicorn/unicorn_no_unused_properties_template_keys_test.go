package linthost

import "testing"

// TestUnicornNoUnusedPropertiesTemplateKeys verifies that template literals
// never participate in key matching, on either side of an access.
//
// Upstream classifies keys through ESTree `Literal` nodes only. A template
// literal index (`foo[`+"`a`"+`]`) is not a Literal, so it counts as an
// unpredictable access that keeps every property alive; a template literal
// computed KEY has no extractable name, so no static access can ever reach
// it and it reports with its source text as the display name. Treating
// templates like plain strings would silently flip both halves.
//
//  1. Access one object through a template index, and give another object a
//     template computed key beside a plain used property.
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert only the template-keyed property reports, with backticks
//     preserved in its message.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed engine compares the exact authored property-name/line set, exposing template indexes treated as static strings or computed template keys given invented names.
// @evidence contracts/testing.md#independent-expectations The official Unicorn Literal-only static-key extraction policy deliberately distinguishes TemplateLiteral nodes from plain string keys.
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
