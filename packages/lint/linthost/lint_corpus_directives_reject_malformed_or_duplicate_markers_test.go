package linthost

import (
  "regexp"
  "strings"
  "testing"
)

// TestLintCorpusDirectivesRejectMalformedOrDuplicateMarkers verifies that every
// reserved corpus directive parses exactly once or fails before execution.
//
// A valid expectation keeps a fixture classified, so a malformed option or
// filename directive that was merely ignored would falsely leave an option or
// path branch uncovered. A marker-shaped line that does not parse, and a
// directive repeated for one rule or file, must therefore be errors.
//
// 1. Mix a valid directive with a missing-colon marker, and repeat options and
//    filename directives.
// 2. Parse them through the loader's option, filename and clean-rule readers.
// 3. Assert each contract violation is reported with the fixture's name.
// 4. Assert the well-formed neighbors apply: options upgrade the severity to a
//    tuple with its authored payload, and a clean directive returns its rule name.
//
// @evidence contracts/testing.md#behavioral-verification corpusApplyOptions, corpusResolveSourcePath and corpusParseClean are called on authored sources; malformed and duplicate forms must return an error naming the fixture, and the valid options and clean forms must return the [severity, options] tuple with enabled:true and the clean rule name they declare. corpusResolveSourcePath is exercised only on its rejection paths.
// @evidence contracts/testing.md#independent-expectations The directive grammar (`@ttsc-corpus-options: <rule> <json>`, `@ttsc-corpus-filename: <path>`, `@ttsc-corpus-clean: <rule>`, each at most once per target) is the specification; expected messages and the [severity, options] tuple are literals written from it.
// @evidence contracts/testing.md#distinguishing-cases A missing colon beside a valid directive, a repeated options rule, a repeated filename, an options payload with invalid JSON, an options rule without any annotation, and an empty filename each isolate one rejection; the valid forms are the accepted controls.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusDirectivesRejectMalformedOrDuplicateMarkers is a discoverable Go unit entry that calls the loader's pure parsing functions on in-memory strings; no files, compiler or host are involved.
func TestLintCorpusDirectivesRejectMalformedOrDuplicateMarkers(t *testing.T) {
  expect := func(err error, pattern string) {
    t.Helper()
    if err == nil || !regexp.MustCompile(pattern).MatchString(err.Error()) {
      t.Fatalf("want error matching %q, got %v", pattern, err)
    }
  }
  rules := func() map[string]any { return map[string]any{"rule/name": "error"} }

  _, err := corpusApplyOptions("mixed-options.ts", strings.Join([]string{
    `// @ttsc-corpus-options: rule/name {"enabled":true}`,
    "// @ttsc-corpus-options rule/name {}",
  }, "\n"), rules())
  expect(err, "mixed-options.ts.*malformed.*corpus-options")

  _, err = corpusApplyOptions("duplicate-options.ts", strings.Join([]string{
    `// @ttsc-corpus-options: rule/name {"enabled":true}`,
    `// @ttsc-corpus-options: rule/name {"enabled":false}`,
  }, "\n"), rules())
  expect(err, "duplicate-options.ts.*duplicate.*rule/name")

  _, err = corpusApplyOptions("bad-json.ts", "// @ttsc-corpus-options: rule/name {oops}", rules())
  expect(err, "bad-json.ts.*invalid JSON")

  _, err = corpusApplyOptions("unannotated.ts", `// @ttsc-corpus-options: other/rule {}`, rules())
  expect(err, "unannotated.ts.*other/rule.*no expectation")

  _, err = corpusResolveSourcePath(strings.Join([]string{
    "// @ttsc-corpus-filename: src/valid.ts",
    "// @ttsc-corpus-filename src/ignored.ts",
  }, "\n"), "mixed-filename.ts")
  expect(err, "mixed-filename.ts.*malformed.*corpus-filename")

  _, err = corpusResolveSourcePath(strings.Join([]string{
    "// @ttsc-corpus-filename: src/first.ts",
    "// @ttsc-corpus-filename: src/second.ts",
  }, "\n"), "duplicate-filename.ts")
  expect(err, "duplicate-filename.ts.*at most one corpus-filename")

  _, err = corpusResolveSourcePath("// @ttsc-corpus-filename:", "empty-filename.ts")
  expect(err, "empty-filename.ts.*requires a path")

  _, err = corpusParseClean("two-clean.ts", "// @ttsc-corpus-clean: a/b\n// @ttsc-corpus-clean: c/d\n")
  expect(err, "two-clean.ts.*at most one clean directive")

  accepted := rules()
  configured, err := corpusApplyOptions("accepted.ts", `// @ttsc-corpus-options: rule/name {"enabled":true}`, accepted)
  if err != nil || !configured["rule/name"] {
    t.Fatalf("valid options must apply: %v %v", err, configured)
  }
  tuple, ok := accepted["rule/name"].([]any)
  if !ok || len(tuple) != 2 || tuple[0] != "error" {
    t.Fatalf("options must upgrade the severity to a [severity, options] tuple, got %#v", accepted["rule/name"])
  }
  payload, ok := tuple[1].(map[string]any)
  if !ok || len(payload) != 1 || payload["enabled"] != true {
    t.Fatalf("options must retain the authored enabled payload, got %#v", tuple[1])
  }
  if clean, err := corpusParseClean("clean.ts", "// @ttsc-corpus-clean: a/b\nexport {};\n"); err != nil || clean != "a/b" {
    t.Fatalf("clean directive: %q %v", clean, err)
  }
}
