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
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require the declared pattern is the normalized project-relative form.
 * @evidence contracts/testing.md#independent-expectations A pattern is anchored by the host against the physical project root, so a leading `./` or a Windows separator has to be gone before it leaves here. `Raw` preserves both, which is why the segments are what is published.
 * @evidence contracts/testing.md#distinguishing-cases Configure a Markdown reference written with `./` and backslashes. Publish the rule's project inputs. Assert the declared pattern is the normalized project-relative form.
 * @evidence contracts/testing.md#execution-ownership TestDeclaredGlobsAreNormalizedProjectRelativePatterns is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
