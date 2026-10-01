package linthost

import "testing"

// TestFixObjectShorthandDropsValueTail verifies the objectShorthand
// fixer collapses `{ x: x }` to `{ x }`.
//
// The rule only fires when the property's key identifier equals the
// initializer's identifier, so deleting the `: <initializer>` tail
// preserves runtime semantics. The fixer must leave surrounding
// properties and the brace pair alone.
//
// 1. Parse an object literal with `{ x: x }`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the redundant tail is gone.
//
// @evidence contracts/testing.md#behavioral-verification object-shorthand deletes only the redundant x: x tail and retains x as the shorthand property.
// @evidence contracts/testing.md#independent-expectations The authored { x } result preserves the declaration, braces and JSON.stringify use.
// @evidence contracts/testing.md#distinguishing-cases Equal key/value identifiers are the fixing arm; this case does not assert different-name detection.
// @evidence contracts/testing.md#execution-ownership TestFixObjectShorthandDropsValueTail executes assertFixSnapshot for object-shorthand in process.
func TestFixObjectShorthandDropsValueTail(t *testing.T) {
  assertFixSnapshot(
    t,
    "object-shorthand",
    "const x = 1;\nconst obj = { x: x };\nJSON.stringify(obj);\n",
    "const x = 1;\nconst obj = { x };\nJSON.stringify(obj);\n",
  )
}
