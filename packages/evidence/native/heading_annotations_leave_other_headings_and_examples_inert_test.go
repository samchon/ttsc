package evidence

import (
  "testing"
)

/**
 * TestHeadingAnnotationsLeaveOtherHeadingsAndExamplesInert verifies only a
 * real H2, H3 or H4 heading in readable documentation opens a heading
 * annotation.
 *
 * An H1, H5 or H6 heading, a heading missing the space after its hashes, a
 * heading indented four columns past the documentation margin, and a heading
 * inside a fenced example or an HTML comment all look like annotations and are
 * none. An untagged heading naming a target is an ordinary heading. A valid
 * heading after all of them still opens normally.
 *
 *  1. Parse one JSDoc block holding every inert spelling, then a valid heading.
 *  2. Require exactly the valid acknowledgement and no review.
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations and parseReviews run on one JSDoc block whose lines spell heading annotations at depths one, five and six, without a separating space, indented four columns, inside a tilde fence, inside an HTML comment and as an untagged target heading, followed by a valid H4 citation; the case requires exactly that citation with its literal reason and no review.
 * @evidence contracts/testing.md#independent-expectations ATX grammar admits a heading only with at most three columns of indentation and a space after its hashes, the annotation grammar admits depths two to four, and examples and comments are never annotation text; the single surviving target and reason follow from that, not from parser output.
 * @evidence contracts/testing.md#distinguishing-cases Each inert line is adjacent to a valid spelling by one property: depth, spacing, indentation, fence, comment or missing tag. The trailing valid H4 proves none of them left the parser in a state that blocks recovery; reviews are checked to stay empty as well.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAnnotationsLeaveOtherHeadingsAndExamplesInert is a native Go unit entry that parses an in-memory string in the test process with no filesystem or product host.
 */
func TestHeadingAnnotationsLeaveOtherHeadingsAndExamplesInert(t *testing.T) {
  block := `/**
 * # @evidence fake.md#h1 Unsupported depth.
 * ##### @evidence fake.md#h5 Unsupported depth.
 * ###### @evidence fake.md#h6 Unsupported depth.
 * ##@evidence fake.md#spacing Missing the space.
 *     ## @evidence fake.md#indented Indented code.
 * ~~~markdown
 * ## @evidence fake.md#fenced Fenced example.
 * ~~~
 * <!--
 * ## @evidence fake.md#comment Hidden example.
 * -->
 * ## fake.md#unannounced
 * An untagged target is an ordinary heading.
 * #### @evidence docs/spec.md#recovered
 * Supplies the requirement.
 */`
  declarations := parseDeclarations(block)
  if len(declarations) != 1 ||
    declarations[0].Target != "docs/spec.md#recovered" ||
    declarations[0].Reason != "Supplies the requirement." {
    t.Fatalf("an inert spelling opened an annotation or blocked recovery: %#v", declarations)
  }
  if reviews := parseReviews(block); len(reviews) != 0 {
    t.Fatalf("an inert spelling opened a review: %#v", reviews)
  }
}
