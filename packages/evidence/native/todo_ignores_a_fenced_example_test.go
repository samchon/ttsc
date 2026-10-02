package evidence

import "testing"

// TestTodoIgnoresAFencedExample verifies a '@todo' shown inside a fenced example
// is documentation of the tag rather than a recorded debt.
//
// The declaration parser reads no tag out of a fence, and a block that explains
// the tag by showing it would otherwise be reported as an unrealized contract
// whose only repair is deleting the example. A real tag in the same block still
// counts, so the fence must silence only what it encloses.
//
// 1. Show a '@todo' line inside a fence and require no finding.
// 2. Add a real '@todo' after the fence and require exactly one finding for it.
//
// @evidence contracts/testing.md#behavioral-verification runTodoRule parses each authored source and runs todoRule.Check; the fenced line produces no message, and the tag after the fence produces one message naming its own text.
// @evidence contracts/testing.md#independent-expectations The expected silence and the literal text 'wire it' follow from the rule's contract that a '@todo' tag records owed work and from the package's convention that fences in documentation are examples; neither is read back from the scanner.
// @evidence contracts/testing.md#distinguishing-cases The fenced block alone is the negative case and the same block with a real tag appended is the positive twin, so a scan that ignored the whole block or read every line fails one of them.
// @evidence contracts/testing.md#execution-ownership TestTodoIgnoresAFencedExample is the selectable Go entry; runTodoRule parses its source and invokes todoRule.Check in-process, with no installed consumer, compiled host or filesystem.
func TestTodoIgnoresAFencedExample(t *testing.T) {
  shown := "/**\n * Shows the tag.\n *\n * ```ts\n * @todo this line is an example\n * ```\n */\nexport function shown(): void {}\n"
  assertNoProblems(t, runTodoRule(t, "src/shown.ts", shown))
  owed := "/**\n * Shows the tag.\n *\n * ```ts\n * @todo this line is an example\n * ```\n *\n * @todo wire it\n */\nexport function owed(): void {}\n"
  assertReported(t, runTodoRule(t, "src/owed.ts", owed), "Unrealized '@todo': 'wire it'")
}
