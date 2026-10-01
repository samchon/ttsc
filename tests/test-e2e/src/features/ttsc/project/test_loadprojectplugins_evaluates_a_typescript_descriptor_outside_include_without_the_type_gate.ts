import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../../internal/ttsc/internal/project";

/**
 * Verifies a TypeScript plugin descriptor outside the project's `include` is
 * evaluated without the consumer project's type gate.
 *
 * A descriptor is evaluated through ttsx's runtime hooks, and one the project
 * does not include is a root no build covered. Such a root is type-checked when
 * it is the user's program (samchon/ttsc#1382), but a descriptor is tooling the
 * compiler runs, and the consumer's `types`, `lib`, and strictness were never
 * chosen for it: a descriptor reading `process.env` under `types: []` would
 * stop every build with TS2591. It was never type-gated before, and it is still
 * compiled through the project's options, only without the gate.
 *
 * 1. Create a project with `include: ["src"]` and `types: []` whose plugin is a
 *    `.ts` descriptor outside `src` that reads `process.env` and returns a
 *    descriptor with an empty `source`.
 * 2. Invoke `loadProjectPlugins`.
 * 3. Assert loading reaches descriptor validation (`must declare source`) instead
 *    of failing the descriptor's type check.
 *
 * @evidence contracts/testing.md#behavioral-verification The out-of-include TypeScript descriptor reaches must-declare-source validation rather than root-check failure despite types:[] and process.env.
 * @evidence contracts/testing.md#independent-expectations Tooling descriptors inherit transpilation options without the consumer entry type gate; the authored empty source requires descriptor validation failure.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create a project with `include: ["src"]` and `types: []` whose plugin is a `.ts` descriptor outside `src` that reads `process.env` and returns a descriptor with an empty `source`. 2. Invoke `loadProjectPlugins`. 3. Assert loading reaches descriptor validation (`must declare source`) instead of failing the descriptor's type check.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The out-of-include TypeScript descriptor reaches must-declare-source validation rather than root-check failure despite types:[] and process.env. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_evaluates_a_typescript_descriptor_outside_include_without_the_type_gate =
  () => {
    const root = TestProject.tmpdir("ttsc-descriptor-root-");
    const write = (file: string, text: string): void => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text, "utf8");
    };
    write("package.json", JSON.stringify({ private: true }));
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          types: [],
          plugins: [{ transform: "./plugins/descriptor.ts" }],
        },
        include: ["src"],
      }),
    );
    write("src/index.ts", `export const value: string = "project";\n`);
    write(
      "plugins/descriptor.ts",
      [
        `const configured: string | undefined = process.env.TTSC_DESCRIPTOR_NAME;`,
        `export default { name: configured ?? "descriptor", source: "" };`,
        ``,
      ].join("\n"),
    );

    assert.throws(
      () =>
        loadProjectPlugins({
          binary: "",
          tsconfig: path.join(root, "tsconfig.json"),
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.doesNotMatch(message, /root check failed/);
        assert.match(message, /must declare source/);
        return true;
      },
    );
  };
