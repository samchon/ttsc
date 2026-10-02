import assert from "node:assert/strict";

import { TtscGraphApplication } from "../../../../packages/graph/src/TtscGraphApplication";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies `details` returns at most the first four lines of a producer
 * signature and leaves shorter signatures whole.
 *
 * A declaration head can span many lines, and the answer is an orientation
 * display, so the head is cut at four lines and trimmed; the source span stays
 * available for the rest. A node without a signature gets none rather than an
 * invented one.
 *
 * Known limitation, deliberately not asserted: the cut leaves no marker in the
 * result, and the details audit still says a symbol's signature is complete, so
 * a reader cannot tell a cut head from a whole one. That is a product
 * discrepancy to correct in the audit or the result, not behavior to pin.
 *
 * 1. Build functions whose signature has six lines, exactly four lines, one line,
 *    only whitespace and none.
 * 2. Request `details` for each and read the returned signature.
 * 3. Require the first four lines of the long one, the others whole or absent.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphApplication.inspect_typescript_graph details must return the first four lines for a six-line signature, the whole signature for four lines and for one line, and no signature field for a whitespace-only or absent signature.
 * @evidence contracts/testing.md#independent-expectations The expected strings are the first four authored lines of the authored signature, written as literals from the four-line display cap, not read from the product's constant.
 * @evidence contracts/testing.md#distinguishing-cases Six lines against exactly four distinguishes a cut at the cap from a cut one line early or late; one line, whitespace-only and absent signatures are the non-cut and no-signature negatives; whether the audit or result marks the cut is not asserted because the product does not mark it.
 * @evidence contracts/testing.md#execution-ownership The src/features export calls the application over an in-memory synthetic dump in the unit process; no producer, session or host is started.
 */
export async function test_ttscgraph_details_cuts_a_long_signature_at_four_lines(): Promise<void> {
  const fn = (name: string, signature?: string) => ({
    id: `src/sig.ts#${name}:function`,
    kind: "function" as const,
    name,
    file: "src/sig.ts",
    external: false,
    ...(signature === undefined ? {} : { signature }),
  });
  const six = ["function six(", "  a: string,", "  b: string,", "  c: string,", "  d: string,", "): void"].join("\n");
  const four = ["function four(", "  a: string,", "  b: string,", "): void"].join("\n");
  const graph = createSyntheticGraph([
    fn("six", six),
    fn("four", four),
    fn("one", "function one(): void"),
    fn("blank", "   \n  "),
    fn("none"),
  ]);
  const application = new TtscGraphApplication(graph);
  const signatureOf = async (name: string): Promise<string | undefined> => {
    const output = await application.inspect_typescript_graph({
      question: `What is the signature of ${name}?`,
      draft: { reason: "Read one declaration head.", type: "details" },
      review: "Keep the explicit details request.",
      request: { type: "details", handles: [name] },
    });
    assert.equal(output.result.type, "details");
    if (output.result.type !== "details") assert.fail("details result required");
    assert.equal(output.result.nodes.length, 1, name);
    return output.result.nodes[0]!.signature;
  };
  assert.strictEqual(await signatureOf("six"), ["function six(", "  a: string,", "  b: string,", "  c: string,"].join("\n"));
  assert.strictEqual(await signatureOf("four"), four);
  assert.strictEqual(await signatureOf("one"), "function one(): void");
  assert.strictEqual(await signatureOf("blank"), undefined);
  assert.strictEqual(await signatureOf("none"), undefined);
}
