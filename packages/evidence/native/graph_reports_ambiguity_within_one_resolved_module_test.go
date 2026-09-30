package evidence

import "testing"

/**
 * Verifies one name in two declaration spaces of one module is reported rather
 * than silently resolved.
 *
 * A file may legally declare an interface and a callable under one name.
 * Resolution lands in the right file and still cannot say which unit was meant,
 * and picking one silently would acknowledge an obligation the author never
 * cited — the coverage would look complete while a real unit went unclaimed.
 *
 *  1. Declare a type and a callable of the same name in one module.
 *  2. Select both kinds as evidence and cite the name once.
 *  3. Assert the ambiguity is reported against that module.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies one name in two declaration spaces of one module is reported rather than silently resolved. The original assertions check assert the ambiguity is reported against that module.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A file may legally declare an interface and a callable under one name. Resolution lands in the right file and still cannot say which unit was meant, and picking one silently would acknowledge an obligation the author never cited — the coverage would look complete while a real unit went unclaimed. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a type and a callable of the same name in one module. Select both kinds as evidence and cite the name once. Assert the ambiguity is reported against that module. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphReportsAmbiguityWithinOneResolvedModule is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphReportsAmbiguityWithinOneResolvedModule(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": `
export interface get {
  id: string;
}
export function get(): void {}
`,
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/api/**"],"symbol":["type","function"]}
  }]}`)
  assertProblemContains(t, messages, "Ambiguous evidence target '{@link questions.get}'")
}
