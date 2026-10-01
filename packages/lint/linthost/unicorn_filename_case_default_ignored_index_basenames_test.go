package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseDefaultIgnoredIndexBasenames verifies the exact
// `index.*` exemption set for every case family, plus negative twins outside
// the set.
//
// The exemption is a literal basename set (`index.js`, `index.mjs`,
// `index.cjs`, `index.ts`, `index.tsx`, `index.vue`), consulted after
// directory checks. This host rejects `index.jsx` under pascal case and
// accepts `Index.js` as a compliant stem; ExtensionLowercase and
// DirectoryHandling own uppercase extensions and bad directory segments.
//
// 1. Lint each exempt basename under every case family.
// 2. Lint the adjacent non-exempt shapes.
// 3. Assert exemption exactly for the six literal names.
//
// @evidence contracts/testing.md#behavioral-verification Actual filename evaluation checks default index-name exemptions against literal path names.
// @evidence contracts/testing.md#independent-expectations The supported index basename exception independently permits its documented forms without exempting unrelated stems.
// @evidence contracts/testing.md#distinguishing-cases The six lowercase index basenames stay clean across five case policies; index.jsx reports under pascal case while compliant Index.js is accepted.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseDefaultIgnoredIndexBasenames owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseDefaultIgnoredIndexBasenames(t *testing.T) {
  ignored := []string{"index.js", "index.mjs", "index.cjs", "index.ts", "index.tsx", "index.vue"}
  chosenCases := []string{"camelCase", "camelCaseWithAcronyms", "snakeCase", "kebabCase", "pascalCase"}
  for _, basename := range ignored {
    for _, chosen := range chosenCases {
      assertUnicornFilenameCaseValid(t, basename, `{"case":"`+chosen+`"}`)
    }
  }
  assertUnicornFilenameCaseMessage(
    t,
    "index.jsx",
    `{"case":"pascalCase"}`,
    "Filename is not in pascal case. Rename it to `Index.jsx`.",
  )
  assertUnicornFilenameCaseValid(t, "Index.js", `{"case":"pascalCase"}`)
}
