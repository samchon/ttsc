package evidence

import (
  "testing"
)

/**
 * TestHeadingAnnotationsMeasureIndentationWithTabStops verifies a heading in a
 * documentation comment is measured against the comment's own margin with tab
 * stops, exactly as a fence is.
 *
 * A block written entirely with tab indentation has a tab as its margin, so a
 * heading at that margin opens a section. A heading one tab deeper than the
 * margin sits four columns in, which is indented code, and opens nothing;
 * three spaces in still opens one.
 *
 *  1. Parse a block whose every line is tab-indented, with the heading at the
 *     margin.
 *  2. Parse a space-indented block whose heading carries one extra tab, and one
 *     whose heading carries three extra spaces.
 *  3. Require a section only where the heading is within three columns.
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations runs on three JSDoc blocks: tab-indented throughout with the heading at the margin, space-indented with a tab before the heading, and space-indented with three spaces before it; the case requires the citation with its literal reason in the first and third and no declaration in the second.
 * @evidence contracts/testing.md#independent-expectations ATX headings admit at most three columns of indentation and documentation indentation is measured after the common margin with four-column tab stops, so a margin tab is no indentation, one extra tab is four columns and three spaces are three.
 * @evidence contracts/testing.md#distinguishing-cases A tab as margin versus a tab as extra indentation, and four columns versus three, separate the margin computation from the column limit.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAnnotationsMeasureIndentationWithTabStops is a native Go unit entry that parses in-memory strings in the test process with no filesystem or product host.
 */
func TestHeadingAnnotationsMeasureIndentationWithTabStops(t *testing.T) {
  for _, scenario := range []struct {
    name  string
    block string
    opens bool
  }{
    {"tab margin", "/**\n *\tSummary.\n *\n *\t## @evidence docs/a.md#x\n *\tReason.\n */", true},
    {"one extra tab", "/**\n * Summary.\n *\n * \t## @evidence docs/a.md#x\n * Reason.\n */", false},
    {"three extra spaces", "/**\n * Summary.\n *\n *    ## @evidence docs/a.md#x\n * Reason.\n */", true},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      declarations := parseDeclarations(scenario.block)
      if !scenario.opens {
        if len(declarations) != 0 {
          t.Fatalf("an indented-code heading opened an annotation: %#v", declarations)
        }
        return
      }
      if len(declarations) != 1 || declarations[0].Target != "docs/a.md#x" || declarations[0].Reason != "Reason." {
        t.Fatalf("a heading within three columns must open a section: %#v", declarations)
      }
    })
  }
}
