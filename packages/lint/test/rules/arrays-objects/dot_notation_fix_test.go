package linthost

import "testing"

// TestFixDotNotationRewritesBracketAccessAndSkipsReservedKeys verifies that
// the dotNotation rule emits an autofix turning `obj["foo"]` into `obj.foo`
// for identifier-safe keys, leaves keys that are reserved words alone
// (detection-only), and skips fixtures whose key is not a valid identifier.
//
// Without the autofix the `fix` cascade could not converge over real
// fixtures so the rule had to be removed from several benchmark configs.
// The reserved-word arm is the corner case mentioned by ESLint's
// `allowKeywords: false` mode: even though modern parsers accept dot access
// to keywords, minifiers and older engines can break, so the safe choice is
// to keep bracket syntax for those keys.
//
//  1. Snapshot the canonical `obj["name"]` → `obj.name` rewrite.
//  2. Assert reserved-word keys (`obj["class"]`) keep bracket access — the
//     rule still fires for detection, but no edit is applied.
//  3. Assert hyphenated keys (`obj["not-valid-key"]`) emit no finding so the
//     detection branch is locked too.
func TestFixDotNotationRewritesBracketAccessAndSkipsReservedKeys(t *testing.T) {
  assertFixSnapshot(
    t,
    "dotNotation",
    "const box: any = { name: \"ttsc\" };\nconst value = box[\"name\"];\nJSON.stringify(value);\n",
    "const box: any = { name: \"ttsc\" };\nconst value = box.name;\nJSON.stringify(value);\n",
  )
  assertNoFixSnapshot(
    t,
    "dotNotation",
    "const box: any = { class: \"ttsc\" };\nconst value = box[\"class\"];\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "dotNotation",
    "const box: any = { \"not-valid-key\": \"ttsc\" };\nconst value = box[\"not-valid-key\"];\nJSON.stringify(value);\n",
  )
}
