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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a reference over src/api/** selecting type and function, where one module declares both `interface get` and `function get` and a view cites `{@link questions.get}`; assertProblemContains requires `Ambiguous evidence target '{@link questions.get}'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the resolution contract: one name legally spans two declaration spaces, and resolution cannot say which unit was meant, so picking one silently would acknowledge an obligation the author never cited.
 * @evidence contracts/testing.md#distinguishing-cases A type and a callable of one name in the same module with both kinds selected; ambiguity across two modules is owed to sibling entries, and only containment of the message is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsAmbiguityWithinOneResolvedModule is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
