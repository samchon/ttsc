import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies the host declares every file's inputs complete when no plugin can
 * contribute to them.
 *
 * The rule behind samchon/ttsc#1259: ttsc's own source-to-source transform is
 * syntactic — this lane answers with each file's parsed text and never runs the
 * emit transformer chain — so an output the host alone produced is a function
 * of that file's own text and the compiler options. Without the declaration a
 * consumer must keep revalidating each file's whole reference closure to learn
 * what cannot have changed.
 *
 * 1. Create a plugin-free project whose entry imports a second module.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert both files are declared complete and that nothing was reported as a
 *    dependency of either.
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms main.ts with a type-only Model import and a second interface source; checks exact completeness for both files and absence of optional dependencies.
 * @evidence contracts/testing.md#independent-expectations Without transforms, parsed source depends only on its own input; the two independently authored included filenames establish the expected complete set.
 * @evidence contracts/testing.md#distinguishing-cases Type-only import plus satisfies distinguishes completeness from ordinary value execution; decorator metadata and malformed completeness members are owned by separate boundary/unit entries.
 * @evidence contracts/testing.md#execution-ownership The named feature is discovered by TestExecutor and invokes the native source producer through TtscCompiler.
 * @evidence contracts/e2e.md#necessary-boundary Completeness must originate from the real native no-plugin transform lane and cross API transport; decoder acceptance alone cannot establish that the producer emits it.
 * @evidence contracts/e2e.md#shared-execution One transform returns the whole two-file completeness list; the suite shares built package and compiler resolution without any Go plugin producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project/config and both files are fresh registered fixtures, preventing another case from supplying completeness. Synchronous child completion precedes assertions; TestProject cleans the project at exit.
 * @evidence contracts/e2e.md#preserved-coverage Success, exact completeness list and absent dependencies remain; no claim is made about downstream cache admission or runtime type effects.
 */
export const test_ttsccompiler_transform_declares_every_file_complete_without_a_plugin =
  () => {
    const root = createProject({
      files: FixtureFiles.read("ttsc/ttsccompiler_transform_declares_every_file_complete_without_a_plugin/inputs-1"),
      source:
        'import type { Model } from "./types";\n\nexport const value: string = ({ id: "x" } satisfies Model).id;\n',
    });
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.dependenciesComplete, [
      "src/main.ts",
      "src/types.ts",
    ]);
    assert.equal(result.dependencies, undefined);
  };
