package linthost

import (
  "strings"
  "testing"
)

// TestFixSecurityDetectPseudoRandomBytesProvesAutomaticRename verifies
// `security/detect-pseudoRandomBytes` imposes the rename only for a proven
// Node crypto binding and otherwise leaves it as an opt-in suggestion.
//
// The member name has one Node successor, but a source-level object named
// `crypto` can be an application object. The security binding table identifies
// imports and requires of `crypto` / `node:crypto`, and the checker keeps a
// same-named parameter or block local distinct from that file-wide declaration.
//
//  1. Fix ESM and CommonJS Node crypto bindings, including a value-position
//     read, by rewriting the member name alone.
//  2. Leave the unbound corpus shape and a local `crypto` object unchanged
//     automatically while offering the same explicit suggestion.
//  3. Keep a same-named function parameter in a file that imports Node crypto
//     suggestion-only, proving automatic edits follow checker binding identity
//     rather than a file-wide name table.
//  4. Assert each suggestion-only message names `crypto.randomBytes`, and keep
//     `crypto.randomBytes` and the same member on another object silent.
//
// @evidence contracts/testing.md#behavioral-verification The crypto rule automatically renames only proven Node bindings and exposes exact opt-in rewrites for unbound/local/shadowed crypto.
// @evidence contracts/testing.md#independent-expectations Literal ESM/CommonJS automatic results and three full authored suggestion results preserve unrelated source; titles and message suffix name randomBytes independently.
// @evidence contracts/testing.md#distinguishing-cases Node import/require bindings fix; unbound object, application object and parameter shadow are suggestion-only; canonical API and another object remain silent.
// @evidence contracts/testing.md#execution-ownership TestFixSecurityDetectPseudoRandomBytesProvesAutomaticRename owns all checker-backed snapshot and applyFindingFixesToText calls, retaining row-specific source failure identities.
func TestFixSecurityDetectPseudoRandomBytesProvesAutomaticRename(t *testing.T) {
  assertFixSnapshot(
    t,
    "security/detect-pseudoRandomBytes",
    "import * as crypto from \"node:crypto\";\nconst bytes = crypto.pseudoRandomBytes(16);\nconsole.log(bytes);\n",
    "import * as crypto from \"node:crypto\";\nconst bytes = crypto.randomBytes(16);\nconsole.log(bytes);\n",
  )
  assertFixSnapshot(
    t,
    "security/detect-pseudoRandomBytes",
    "const crypto = require(\"crypto\");\nconst generate = crypto.pseudoRandomBytes;\nconsole.log(generate);\n",
    "const crypto = require(\"crypto\");\nconst generate = crypto.randomBytes;\nconsole.log(generate);\n",
  )

  for index, source := range []string{
    "const bytes = crypto.pseudoRandomBytes(16);\nconsole.log(bytes);\n",
    "const crypto = { pseudoRandomBytes: (size: number) => size };\nconst bytes = crypto.pseudoRandomBytes(16);\nconsole.log(bytes);\n",
    "import * as crypto from \"node:crypto\";\ntype LocalCrypto = { pseudoRandomBytes(size: number): number };\nfunction generate(crypto: LocalCrypto) {\n  return crypto.pseudoRandomBytes(16);\n}\nconsole.log(generate);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "security/detect-pseudoRandomBytes", source, nil)
    if len(findings) != 1 {
      t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
    }
    finding := findings[0]
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 1 {
      t.Fatalf("fix=%+v suggestions=%+v, want suggestion only", finding.Fix, finding.Suggestions)
    }
    if finding.Suggestions[0].Title != "Replace with `crypto.randomBytes`." {
      t.Fatalf("suggestion title = %q", finding.Suggestions[0].Title)
    }
    automatic, applied := applyFindingFixesToText(source, findings)
    if applied != 0 || automatic != source {
      t.Fatalf("automatic edits changed source: applied=%d source=%q", applied, automatic)
    }
    suggested, applied := applyFindingFixesToText(
      source,
      []*Finding{{Fix: finding.Suggestions[0].Edits}},
    )
    if applied != 1 || !strings.Contains(suggested, "crypto.randomBytes") {
      t.Fatalf("suggested edit: applied=%d source=%q", applied, suggested)
    }
    exactSuggestion := []string{
      "const bytes = crypto.randomBytes(16);\nconsole.log(bytes);\n",
      "const crypto = { pseudoRandomBytes: (size: number) => size };\nconst bytes = crypto.randomBytes(16);\nconsole.log(bytes);\n",
      "import * as crypto from \"node:crypto\";\ntype LocalCrypto = { pseudoRandomBytes(size: number): number };\nfunction generate(crypto: LocalCrypto) {\n  return crypto.randomBytes(16);\n}\nconsole.log(generate);\n",
    }[index]
    if suggested != exactSuggestion {
      t.Fatalf("suggestion changed unrelated source:\nwant %q\ngot %q", exactSuggestion, suggested)
    }
    if !strings.HasSuffix(finding.Message, "Use `crypto.randomBytes` instead.") {
      t.Fatalf("message = %q", finding.Message)
    }
  }

  assertRuleSkipsSource(
    t,
    "security/detect-pseudoRandomBytes",
    "const bytes = crypto.randomBytes(16);\nconsole.log(bytes);\n",
  )
  assertRuleSkipsSource(
    t,
    "security/detect-pseudoRandomBytes",
    "const bytes = weakRandom.pseudoRandomBytes(16);\nconsole.log(bytes);\n",
  )
}
