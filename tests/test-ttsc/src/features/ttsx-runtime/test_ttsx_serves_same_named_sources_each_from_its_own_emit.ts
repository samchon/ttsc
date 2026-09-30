import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx serves several sources that share a file name, each from its
 * own compiled output.
 *
 * The negative twin of the samchon/ttsc#1382 cases: removing name matching must
 * not make the lookup lose a file it legitimately owns. Two `index.ts` files
 * the build emitted resolve to their own outputs whether they are imported
 * statically or required by a computed path, and a third `index.ts` the build
 * never saw is compiled on its own instead of borrowing either.
 *
 * 1. Create `src/a/index.ts` and `src/b/index.ts` inside `include`, and
 *    `tools/index.ts` outside it.
 * 2. Import the first two statically, then require all three by computed paths.
 * 3. Assert every module reports its own identity.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx prints a,b,a,b,tools from static and computed-path requests for three index.ts identities, detecting basename borrowing or missing excluded-source fallback.
 * @evidence contracts/testing.md#independent-expectations Authored modules export literals a, b and tools; ordered output follows entry requests independently of ownership metadata.
 * @evidence contracts/testing.md#distinguishing-cases Two included same-name modules have static and dynamic consumers, while the excluded third uses fallback compilation. Twin-extension precedence has its companion.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one real launcher and five module observations.
 * @evidence contracts/e2e.md#necessary-boundary Native emitted ownership and Node dynamic source serving must retain full-path identity. Direct index calls do not certify this loading connection.
 * @evidence contracts/e2e.md#shared-execution One root preparation/host serves five requests; the excluded source needs fallback emit within that same host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Immutable distinct source paths avoid identity aliasing; repeated included consumers intentionally share Node values. Synchronous completion precedes cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status and ordered five-identity assertion remain, distinguishing included paths and excluded fallback.
 */
export function test_ttsx_serves_same_named_sources_each_from_its_own_emit() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "same-names", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/a/index.ts": `export const identity: string = "a";\n`,
      "src/b/index.ts": `export const identity: string = "b";\n`,
      "tools/index.ts": `export const identity: string = "tools";\n`,
      "src/main.ts": [
        `import { identity as a } from "./a/index";`,
        `import { identity as b } from "./b/index";`,
        `declare const require: (id: string) => { identity: string };`,
        `declare const __dirname: string;`,
        `const dynamic: string[] = ["a", "b", "../tools"].map(`,
        `  (name) => require(__dirname + "/" + name + "/index.ts").identity,`,
        `);`,
        `console.log([a, b, ...dynamic].join(","));`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "a,b,a,b,tools");
  }
