package linthost

import (
  "strings"
  "testing"
)

// TestFixSecurityDetectPseudoRandomBytesRenamesToRandomBytes verifies
// `security/detect-pseudoRandomBytes` applies the one rename that resolves it
// and names the replacement in the message.
//
// Unlike `detect-new-buffer`, there is exactly one successor and it is the
// same function: Node deprecated `crypto.pseudoRandomBytes` as an alias of
// `crypto.randomBytes` (DEP0115), so the rewrite cannot change behavior on any
// release that still exposes the alias, and on the older releases where the
// two genuinely differed it can only strengthen the result. That is what makes
// it safe to impose rather than suggest.
//
//  1. Fix a call and assert the member name alone is rewritten.
//  2. Assert the same rewrite applies where the API is read as a value rather
//     than called, since the rule reports the member access, not the call.
//  3. Assert the message names `crypto.randomBytes`.
//  4. Assert the negative twins stay silent: `crypto.randomBytes` itself, and
//     the same member name on an object that is not `crypto`.
func TestFixSecurityDetectPseudoRandomBytesRenamesToRandomBytes(t *testing.T) {
  source := "const bytes = crypto.pseudoRandomBytes(16);\nconsole.log(bytes);\n"
  assertFixSnapshot(
    t,
    "security/detect-pseudoRandomBytes",
    source,
    "const bytes = crypto.randomBytes(16);\nconsole.log(bytes);\n",
  )
  assertFixSnapshot(
    t,
    "security/detect-pseudoRandomBytes",
    "const generate = crypto.pseudoRandomBytes;\nconsole.log(generate);\n",
    "const generate = crypto.randomBytes;\nconsole.log(generate);\n",
  )

  _, _, findings := runRuleFindingsSnapshot(t, "security/detect-pseudoRandomBytes", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
  }
  if !strings.HasSuffix(findings[0].Message, "Use `crypto.randomBytes` instead.") {
    t.Fatalf("message = %q", findings[0].Message)
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
