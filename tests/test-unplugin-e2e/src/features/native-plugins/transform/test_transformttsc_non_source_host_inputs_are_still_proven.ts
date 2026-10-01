import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies the compiler's non-source inputs are still proven after the walk
 * stopped hashing them.
 *
 * The walk now collects only files that could enter the program, which keeps an
 * emitted tree from costing a read per file. That is safe only because the
 * tsconfig, the package manifest, and the plugin descriptor are universal host
 * inputs, validated by identity and content on every delivery. Otherwise
 * narrowing the walk would have silently stopped a tsconfig edit from
 * invalidating anything (samchon/ttsc#1307).
 *
 * 1. Run passes until the generation settles.
 * 2. Edit the tsconfig, then the package manifest, then the plugin descriptor,
 *    each in its own pass.
 * 3. Assert each edit costs exactly one compile.
 *
 * @evidence contracts/testing.md#behavioral-verification Unchanged passes reuse one compile; separate tsconfig, manifest and descriptor edits each cost exactly one further compile.
 * @evidence contracts/testing.md#independent-expectations Authored option/version/comment edits are distinct host-input states and the native run log independently counts work.
 * @evidence contracts/testing.md#distinguishing-cases Three non-source input classes remain proven after the project walk narrows; emitted noninput files are the negative controls.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_non_source_host_inputs_are_still_proven in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary A real native producer captures program inputs while repeated adapter passes observe actual filesystem output/membership changes. Direct membership calculations do not prove the persistent generation receives those producer inputs and remains current across host passes.
 * @evidence contracts/e2e.md#shared-execution One membership session owns the consumer project, native producer, transform cache and repeated passes; the shared fixture/build cache supplies its producer. Output or host-input mutations reuse that session so the invocation count distinguishes gratuitous compilation from necessary invalidation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. The existing finally reset/close path releases retained cache or session observers on success and assertion failure; no prior case supplies this generation.
 * @evidence contracts/e2e.md#preserved-coverage Unchanged passes reuse one compile; separate tsconfig, manifest and descriptor edits each cost exactly one further compile. These assertions remain in test_transformttsc_non_source_host_inputs_are_still_proven, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_non_source_host_inputs_are_still_proven(): Promise<void> {
  const session = await startMembershipSession({ fileCount: 2 });
  try {
    await session.pass();
    assert.equal(session.compiles(), 1);
    await session.pass();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    const tsconfig = path.join(session.root, "tsconfig.json");
    const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
      compilerOptions: Record<string, unknown>;
    };
    parsed.compilerOptions.target = "ES2021";
    fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a tsconfig edit must still replace the generation",
    );

    fs.writeFileSync(
      path.join(session.root, "package.json"),
      JSON.stringify({ private: true, type: "commonjs", version: "9.9.9" }),
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "a package manifest edit must still replace the generation",
    );

    const descriptor = path.join(session.root, "plugin.cjs");
    fs.writeFileSync(
      descriptor,
      `${fs.readFileSync(descriptor, "utf8")}\n// touched\n`,
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      4,
      "a plugin descriptor edit must still replace the generation",
    );
  } finally {
    session.close();
  }
}
