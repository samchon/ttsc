import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../../internal/ttsc/internal/project";

/**
 * Verifies a TypeScript plugin descriptor outside the project's `include` is
 * evaluated without the consumer project's type gate.
 *
 * A descriptor may reach ttsx runtime hooks through a conditional fallback; a
 * typed filename alone does not establish that selection. One the project
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
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner calls the built workspace loadProjectPlugins owner with the actual typed descriptor. The two error regexes observe returned validation admission, not a measured conditional ttsx fallback or installed consumer.
 * @evidence contracts/e2e.md#necessary-boundary Actual typed evaluation must carry its descriptor/error into loadProjectPlugins validation. A direct empty-source validator cannot establish that producer-to-parent admission connection; the authored error regexes alone do not certify which evaluator executed.
 * @evidence contracts/e2e.md#shared-execution One load observes the authored rejection. This case supplies no fake Go executable or repeated load, and asserts no warm cache hit, Program reuse or avoided preparation. Actual selected evaluator and cache identity require separate observation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before its four-file preparation. No ambient environment is mutated by this case; owner defaults may select ambient cache/tool state, so a private root alone is not cold-cache proof. Returned throw is not arbitrary descendant join.
 * @evidence contracts/e2e.md#preserved-coverage Original four authored files, types:[], include src, process.env read, empty source, must-declare-source positive and root-check-failed negative regexes remain. They do not prove actual conditional fallback selection; runtime/manifest/survival are unverified and donor remains.
 */
export const test_loadprojectplugins_evaluates_a_typescript_descriptor_outside_include_without_the_type_gate =
  () => {
    const root = TestProject.tmpdir("ttsc-descriptor-root-");
    TestProject.retainTemporaryDirectory(root, "Typed descriptor descendants are not joined");
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
