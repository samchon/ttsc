package evidence

import (
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * TestReferencePolicyCombinesStrictFlagsForPositiveAndExcludedHosts
 * Verifies literal positive and excluded hosts under all strict flags.
 *
 * The complete graph assigns Contract and Pricing to separate TypeScript
 * functions. Its negative twin excludes Contract, so the same strict policy
 * must report the forbidden answer, zero positive units and missing coverage.
 *
 * 1. Evaluate both positive hosts with noEvidenceExclude, uniqueEvidence and
 *    singleEvidencePerSymbol enabled on their one Markdown reference.
 * 2. Evaluate the original excluded host against its one authored Contract item.
 * 3. Collect both rule states and every original strict-policy repair fragment.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtSeverity calls the actual graph rule with all three strict flags co-active; separate Contract/Pricing functions pass, whereas an excluded Contract fails with the positive-evidence repair, exactly-one cardinality and forbidden-exclusion coverage messages.
 * @evidence contracts/testing.md#independent-expectations Literal authored H2 targets, TypeScript functions, true policy flags and expected messages reproduce the original consumer contract; no observed diagnostic supplies an expected value or synthetic process status.
 * @evidence contracts/testing.md#distinguishing-cases Two positive functions each owning one unit contrast with one exclusion-only function under the identical strict reference options; all flags are enabled together rather than relying on separate single-policy tests.
 * @evidence contracts/testing.md#execution-ownership TestReferencePolicyCombinesStrictFlagsForPositiveAndExcludedHosts is the sole selectable native Go unit entry in this file. The real parser, Markdown loader, config decoder and graph rule run within this process; no installation or compiler Program is needed, and nonfatal assertions collect both arms while CLI exit-status transport remains in its canonical integration owner.
 */
func TestReferencePolicyCombinesStrictFlagsForPositiveAndExcludedHosts(t *testing.T) {
	config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "noEvidenceExclude":true,
      "uniqueEvidence":true,
      "singleEvidencePerSymbol":true
    }
  }]}`
	positive := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
		"docs/spec.md": "## Contract {#contract}\n\n## Pricing {#pricing}\n",
		"src/first.ts": `/** @evidence docs/spec.md#contract Implements the contract. */
export function first(): void {}
`,
		"src/second.ts": `/** @evidence docs/spec.md#pricing Implements the pricing rule. */
export function second(): void {}
`,
	}, config, rule.SeverityError)
	if positive.failed || len(positive.messages) != 0 {
		t.Errorf("one positive owner per unit must pass all strict flags: failed=%t\n%s", positive.failed, strings.Join(positive.messages, "\n"))
	}

	negative := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
		"docs/spec.md": "## Contract {#contract}\n",
		"src/rejected.ts": `/** @evidenceExclude docs/spec.md#contract No implementation. */
export function rejected(): void {}
`,
	}, config, rule.SeverityError)
	if !negative.failed {
		t.Errorf("an excluded host must fail the actual strict graph rule")
	}
	output := strings.Join(negative.messages, "\n")
	for _, expected := range []string{
		"Forbidden @evidenceExclude for 'docs/spec.md#contract'",
		"noEvidenceExclude requires positive @evidence",
		"TypeScript function 'rejected'",
		"cites 0 distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1",
		"Missing acknowledgement for 'docs/spec.md#contract'",
		"this reference forbids @evidenceExclude",
	} {
		if !strings.Contains(output, expected) {
			t.Errorf("missing literal strict-policy diagnostic %q:\n%s", expected, output)
		}
	}
}
