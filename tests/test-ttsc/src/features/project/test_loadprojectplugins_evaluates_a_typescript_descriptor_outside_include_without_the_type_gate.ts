import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";

/**
 * Verifies a TypeScript plugin descriptor outside the project's `include` is
 * evaluated without the consumer project's type gate.
 *
 * A descriptor is evaluated through ttsx's runtime hooks, and one the project
 * does not include is a root no build covered. Such a root is type-checked when
 * it is the user's program (samchon/ttsc#1382), but a descriptor is tooling
 * the compiler runs, and the consumer's `types`, `lib`, and strictness were
 * never chosen for it: a descriptor reading `process.env` under `types: []`
 * would stop every build with TS2591. It was never type-gated before, and it is
 * still compiled through the project's options, only without the gate.
 *
 * 1. Create a project with `include: ["src"]` and `types: []` whose plugin is a
 *    `.ts` descriptor outside `src` that reads `process.env` and returns a
 *    descriptor with an empty `source`.
 * 2. Invoke `loadProjectPlugins`.
 * 3. Assert loading reaches descriptor validation (`must declare source`)
 *    instead of failing the descriptor's type check.
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
