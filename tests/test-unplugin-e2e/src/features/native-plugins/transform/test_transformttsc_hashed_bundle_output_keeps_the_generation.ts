import assert from "node:assert/strict";

import { emitHashedBundle } from "../../../internal/transform-program-membership/emitHashedBundle";
import { startMembershipSession } from "../../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies content-hashed bundle output costs no compile, in a directory no
 * configuration names.
 *
 * Rewriting one output file in place is already free, because content is
 * compared over declared inputs alone. Content-hashed filenames are not: every
 * rebuild removes a name and adds another, which is a directory membership
 * change, and the digest used to record every entry, so a bundler's own output
 * invalidated the generation that produced it once per rebuild
 * (samchon/ttsc#1307). `lib` is neither the `outDir` nor a name the walk
 * refuses, so only the input-extension rule can make this pass: a project that
 * admits no JavaScript cannot gain a `.js` input.
 *
 * 1. Start a membership session over a project that admits no JavaScript.
 * 2. Emit a content-hashed bundle into `lib` and run a pass, four times.
 * 3. Assert the project compiled once.
 *
 * @evidence contracts/testing.md#behavioral-verification Four passes adding/removing content-hashed JS bundles under lib preserve one native compile.
 * @evidence contracts/testing.md#independent-expectations Fixture tsconfig admits no JavaScript; emitted hashes are deliberate noninputs and the independent run log counts compilation.
 * @evidence contracts/testing.md#distinguishing-cases File membership changes for excluded JS outputs must remain free even under a directory not specially excluded.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_hashed_bundle_output_keeps_the_generation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary A real native producer captures program inputs while repeated adapter passes observe actual filesystem output/membership changes. Direct membership calculations do not prove the persistent generation receives those producer inputs and remains current across host passes.
 * @evidence contracts/e2e.md#shared-execution One membership session owns the consumer project, native producer, transform cache and repeated passes; the shared fixture/build cache supplies its producer. Output or host-input mutations reuse that session so the invocation count distinguishes gratuitous compilation from necessary invalidation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. The existing finally reset/close path releases retained cache or session observers on success and assertion failure; no prior case supplies this generation.
 * @evidence contracts/e2e.md#preserved-coverage Four passes adding/removing content-hashed JS bundles under lib preserve one native compile. These assertions remain in test_transformttsc_hashed_bundle_output_keeps_the_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_hashed_bundle_output_keeps_the_generation(): Promise<void> {
  const session = await startMembershipSession();
  try {
    for (let build = 1; build <= 4; build += 1) {
      emitHashedBundle(session.root, "lib", build);
      await session.pass();
    }
    assert.equal(
      session.compiles(),
      1,
      "content-hashed output must not cost a compile per rebuild",
    );
  } finally {
    session.close();
  }
}
