package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseUnicodeSegments verifies non-ASCII characters remain
// verbatim while the native rule checks the adjacent ASCII word runs.
//
// The native word splitter only treats `[A-Za-z0-9_-]` as checkable word
// characters; any other code point — accented letters included — is an
// ignored run that survives into rename samples unchanged. A name whose word
// runs are all valid therefore passes even with accents between them.
//
//  1. Lint an accented lowercase name (valid) and its capitalized twin
//     (invalid).
//  2. Assert the rename sample preserves the accented characters.
//
// @evidence contracts/testing.md#behavioral-verification Actual filename checking evaluates the retained Unicode path segments and requires their authored normalized alternatives or silence.
// @evidence contracts/testing.md#independent-expectations Literal Unicode case/separator expectations are independent inputs to the supported case policy, not output captured from Go.
// @evidence contracts/testing.md#distinguishing-cases An accented lowercase stem is clean, its capitalized twin is invalid with the accented characters kept verbatim in the rename sample (no non-ASCII case conversion is exercised), and a stem made only of ignored characters is clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseUnicodeSegments owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseUnicodeSegments(t *testing.T) {
  assertUnicornFilenameCaseValid(t, "src/résumé.js", "")
  assertUnicornFilenameCaseMessage(
    t,
    "src/Résumé.js",
    "",
    "Filename is not in kebab case. Rename it to `résumé.js`.",
  )
  // A stem made only of ignored characters has no checkable words at all.
  assertUnicornFilenameCaseValid(t, "src/foo/[].js", "")
}
