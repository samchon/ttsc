package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseDirectoryHandling verifies directory checking order,
// the `$` directory exemption, `checkDirectories: false`, and the
// path-boundary rules for nested files inside and outside the project directory.
//
// The native rule reports the first offending directory before checking the
// basename, skips `$`-prefixed directory segments, and checks outside-project
// files by basename alone. The outside `Src` segment must not be reported.
//
//  1. Lint layouts with bad directories, `$` directories, and disabled
//     directory checking.
//  2. Lint project-rooted and outside-project absolute paths.
//  3. Assert the independent literal diagnostic or silence for each.
//
// @evidence contracts/testing.md#behavioral-verification The rule resolves virtual in-project and outside-project paths and checks configured directory handling against exact messages.
// @evidence contracts/testing.md#independent-expectations The supported checkDirectories scope and authored path/case alternatives establish report ordering and outside-project exclusions independently.
// @evidence contracts/testing.md#distinguishing-cases Retained root, nested-directory and outside-project paths cover both checked and exempt segments.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseDirectoryHandling owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseDirectoryHandling(t *testing.T) {
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/file.js",
    "",
    "Directory name `FooBar` is not in kebab case. Rename it to `foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/_FOO-BAR/file.js",
    "",
    "Directory name `_FOO-BAR` is not in kebab case. Rename it to `_foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/$UserId/fooBar.js",
    "",
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  // The directory diagnostic wins over the filename diagnostic, and only one
  // finding is reported per file.
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/foo_bar.js",
    "",
    "Directory name `FooBar` is not in kebab case. Rename it to `foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo-bar/foo_bar.js",
    "",
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/index.js",
    "",
    "Directory name `FooBar` is not in kebab case. Rename it to `foo-bar`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/FooBar/foo_bar.js",
    `{"case":"kebabCase","checkDirectories":false}`,
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo-bar/foo_bar.js",
    `{"cases":{"camelCase":true,"pascalCase":true},"checkDirectories":false}`,
    "Filename is not in camel case or pascal case. Rename it to `fooBar.js` or `FooBar.js`.",
  )
  // A file outside the project directory is judged by basename only: the
  // PascalCase `Src` directory must not surface.
  assertUnicornFilenameCaseMessageAbsolute(
    t,
    "/outside/Src/fooBar.js",
    "",
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  // A valid basename outside the project stays silent even under invalid
  // directories.
  findings := runUnicornFilenameCaseAbsolute(t, "/outside/Src/foo-bar.js", "")
  if len(findings) != 0 {
    t.Fatalf("outside-project clean basename: want no findings, got %d (%+v)", len(findings), findings)
  }
}
