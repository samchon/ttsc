package evidence

import (
  "testing"
)

/**
 * TestHeadingAndLineAnnotationsShareTheRenderedExamplePolicy verifies the two
 * annotation forms are read or refused together in every documentation
 * comment region.
 *
 * A heading form that a region hides while the line form beside it stays
 * readable, or the reverse, would make the spelling an author chose decide
 * whether a citation counts. Inside a TypeScript documentation comment a
 * fenced example and an HTML comment hide both forms; a `<pre>` element is not
 * an example region in that grammar and hides neither.
 *
 *  1. Put a line-form and a heading-form citation inside a fence, inside an
 *     HTML comment and inside a `<pre>` element of one JSDoc block each.
 *  2. Require both forms to be absent from the first two and present in the
 *     third.
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations runs on three JSDoc blocks, each holding `@evidence docs/a.md#line` and a `## @evidence docs/a.md#heading` section inside one region, and the case compares the parsed target set with the expectation for that region.
 * @evidence contracts/testing.md#independent-expectations Fences and HTML comments are example and metadata regions of the documentation grammar for both forms, while the grammar assigns `<pre>` no region in TypeScript documentation; whatever a region decides, the contract requires the two spellings of one tag to receive the same decision.
 * @evidence contracts/testing.md#distinguishing-cases Three region kinds, two of which hide and one of which does not, each with both spellings side by side so a divergence in either direction fails.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAndLineAnnotationsShareTheRenderedExamplePolicy is a native Go unit entry that parses in-memory strings in the test process with no filesystem or product host.
 */
func TestHeadingAndLineAnnotationsShareTheRenderedExamplePolicy(t *testing.T) {
  inner := " * @evidence docs/a.md#line Line reason.\n * ## @evidence docs/a.md#heading\n * Heading reason.\n"
  for _, scenario := range []struct {
    name    string
    open    string
    close   string
    visible bool
  }{
    {"fence", " * ~~~text\n", " * ~~~\n", false},
    {"html comment", " * <!--\n", " * -->\n", false},
    {"pre element", " * <pre>\n", " * </pre>\n", true},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      targets := map[string]bool{}
      for _, declaration := range parseDeclarations("/**\n * Summary.\n *\n" + scenario.open + inner + scenario.close + " */") {
        targets[declaration.Target] = true
      }
      if targets["docs/a.md#line"] != scenario.visible || targets["docs/a.md#heading"] != scenario.visible || len(targets) != map[bool]int{true: 2, false: 0}[scenario.visible] {
        t.Fatalf("the two forms disagreed or the region decided wrongly: %v", targets)
      }
    })
  }
}
