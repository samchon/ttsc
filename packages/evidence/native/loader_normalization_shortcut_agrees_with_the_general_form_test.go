package evidence

import (
  "testing"
)

/**
 * Verifies the loader's normalization shortcut answers what the general form
 * would.
 *
 * `projectPath` is the identity every module candidate and Program source is
 * keyed by, so two spellings that normalize differently become two modules. The
 * shortcut returns a path unchanged when it is already that identity; anything
 * else has to fall through.
 *
 *  1. Take clean, unclean, absolute, and separator-mixed spellings.
 *  2. Normalize each through the loader.
 *  3. Assert the shortcut and the general form agree.
 * @evidence contracts/testing.md#behavioral-verification typeScriptLoader.projectPath must leave clean project-relative inputs unchanged and match generalProjectPath for every nonempty input. The empty input executes the loader but has no comparison assertion, so this test does not establish its normalized result.
 * @evidence contracts/testing.md#independent-expectations generalProjectPath uses filepath.FromSlash, IsAbs, Join, Clean and Rel directly rather than calling the loader. That standard-library calculation provides the differential expectation; the clean-input check additionally requires identity. Shared interpretation mistakes and the empty result remain oracle limitations.
 * @evidence contracts/testing.md#distinguishing-cases Named subcases contain ordinary source paths, scoped-package declaration paths, dot-slash, parent traversal that returns inside the root, backslashes, an absolute source and an empty input. The clean inputs pin identity; nonempty inputs pin equivalence to the general helper.
 * @evidence contracts/testing.md#execution-ownership TestLoaderNormalizationShortcutAgreesWithTheGeneralForm is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestLoaderNormalizationShortcutAgreesWithTheGeneralForm(t *testing.T) {
  loader := &typeScriptLoader{root: "/repo"}
  for _, value := range []string{
    "src/x.ts",
    "node_modules/@org/api/lib/index.d.ts",
    "./src/x.ts",
    "src/../src/x.ts",
    "src\\x.ts",
    "/repo/src/x.ts",
    "",
  } {
    t.Run(value, func(t *testing.T) {
      shortcut := loader.projectPath(value)
      if isCleanProjectRelativePath(value) && shortcut != value {
        t.Fatalf("a clean path was rewritten to %q", shortcut)
      }
      general := generalProjectPath(loader.root, value)
      if value != "" && shortcut != general {
        t.Fatalf(
          "projectPath(%q) = %q, general form = %q",
          value,
          shortcut,
          general,
        )
      }
    })
  }
}
