package evidence

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies a declared glob is the compiled form rather than the author's
 * spelling.
 *
 * A pattern is anchored by the host against the physical project root, so a
 * leading `./` or a Windows separator has to be gone before it leaves here.
 * `Raw` preserves both, which is why the segments are what is published.
 *
 *  1. Configure a Markdown reference written with `./` and backslashes.
 *  2. Publish the rule's project inputs.
 *  3. Assert the declared pattern is the normalized project-relative form.
 *
 * @evidence contracts/testing.md#behavioral-verification declaredInputs calls graphRule.ProjectInputs on a configuration whose Markdown reference selects `./docs\guides/**\/*.md`, and assertDeclares requires the glob inputs to be exactly `docs/guides/**\/*.md`.
 * @evidence contracts/testing.md#independent-expectations The expected pattern is an authored literal: the host anchors declared patterns against the physical project root, so a leading `./` and a backslash separator must be gone from the published form even though the raw spelling keeps them.
 * @evidence contracts/testing.md#distinguishing-cases One pattern written with both a `./` prefix and a Windows separator; the exact one-element glob set also fails if the raw spelling or a second pattern is published. Absolute and negated patterns are owned by sibling glob entries.
 * @evidence contracts/testing.md#execution-ownership TestDeclaredGlobsAreNormalizedProjectRelativePatterns is a Go unit entry in the native test process; it calls ProjectInputs on an in-memory project input context with no sources, consumer install or product host.
 */
func TestDeclaredGlobsAreNormalizedProjectRelativePatterns(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["./docs\\guides/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputGlob, []string{"docs/guides/**/*.md"})
}
