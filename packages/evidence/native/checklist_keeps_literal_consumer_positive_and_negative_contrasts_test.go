package evidence

import (
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * TestChecklistKeepsLiteralConsumerPositiveAndNegativeContrasts
 * Verifies literal consumer checklist positive and negative contrasts.
 *
 * One host answers both items while another honestly excludes the second. The
 * negative pair instead combines a partial host with a whole-document citation;
 * the aggregate refusal cannot erase the partial host's missing item.
 *
 * 1. Evaluate complete and mixed hosts together against both authored H2 items.
 * 2. Evaluate the original partial and broad hosts under the same checklist.
 * 3. Collect both rule failure states and every original diagnostic fragment.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual graph rule receives native-parsed TypeScript and a disk-loaded Markdown checklist through runIndexRuleAtSeverity; complete plus mixed is clean, while partial plus broad reports its shortfall, aggregate refusal and repair.
 * @evidence contracts/testing.md#independent-expectations Literal source tags, two authored anchors, expected rule states and three diagnostic fragments come from the original positive/negative consumer contract, without computing expectations from the graph result.
 * @evidence contracts/testing.md#distinguishing-cases Full citation plus item exclusion is contrasted with a one-item citation plus an aggregate target in the same two-host population; exact negative count preserves the aggregate host's local suppression without hiding the partial host.
 * @evidence contracts/testing.md#execution-ownership TestChecklistKeepsLiteralConsumerPositiveAndNegativeContrasts is the sole selectable Go unit entry in this file. Both fixture graphs run in process with the pinned native parser and actual graph rule, no installed consumer or compiler Program; captured rule failure is not a fabricated CLI exit status, and nonfatal checks collect both arms.
 */
func TestChecklistKeepsLiteralConsumerPositiveAndNegativeContrasts(t *testing.T) {
	positive := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
		"docs/rules.md": checklistDocument,
		"src/first.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 */
export function first(): void {}
`,
		"src/second.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides here too.
 * @evidenceExclude docs/rules.md#no-whack-a-mole This helper has one case.
 */
export function second(): void {}
`,
	}, checklistConfig, rule.SeverityError)
	if positive.failed || len(positive.messages) != 0 {
		t.Errorf("complete and mixed checklist hosts must pass: failed=%t\n%s", positive.failed, strings.Join(positive.messages, "\n"))
	}

	negative := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
		"docs/rules.md": checklistDocument,
		"src/partial.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function partial(): void {}
`,
		"src/broad.ts": `/** @evidence docs/rules.md Everything in here is honored. */
export function broad(): void {}
`,
	}, checklistConfig, rule.SeverityError)
	if !negative.failed {
		t.Errorf("partial and aggregate checklist hosts must fail the actual graph rule")
	}
	if len(negative.messages) != 2 {
		t.Errorf("expected one partial shortfall and one aggregate refusal, got:\n%s", strings.Join(negative.messages, "\n"))
	}
	output := strings.Join(negative.messages, "\n")
	for _, expected := range []string{
		"TypeScript function 'partial'",
		"has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'",
		"Aggregate @evidence target 'docs/rules.md'",
		"Cite each item this host answers for",
	} {
		if !strings.Contains(output, expected) {
			t.Errorf("missing literal checklist diagnostic %q:\n%s", expected, output)
		}
	}
}
