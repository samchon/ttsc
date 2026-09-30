import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies preload ordering and program argument transport in one launcher host.
 *
 * The exact launcher parser is exercised separately for every original argv
 * shape. This boundary combines all require spellings and source extensions,
 * preload effects and the program-only tail in one checked TypeScript run.
 *
 * 1. Pass mixed repeated CJS/TS/TSX preloads before the entry.
 * 2. Pass generator, terminal, watch, build and require tokens after the entry.
 * 3. Assert ordered preload lines, their visible effect, exact argv, cwd/marker side effects and no post-entry preload.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx executes all preloads before its checked entry and forwards the exact tail; output assertions detect dropped or reordered preloads, unwanted post-entry effects and compiler contamination.
 * @evidence contracts/testing.md#independent-expectations Fixture preloads announce their names and set a loaded flag; literal argv tokens define the expected program arguments independently of parsing or emitted source.
 * @evidence contracts/testing.md#distinguishing-cases Spaced and inline long/short require forms with CJS/TS/TSX inputs run together; the post-entry require has an observable negative side effect, and terminal/watch/build flags plus an inner separator remain program data. Pre-entry spaced target/module values and bare pretty also reach the actual compiler without consuming the entry. The parser unit owns each original standalone shape.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one actual launcher/compiler/Node host and fixture inputs; the portable argv Cartesian population executes in test_parse_ttsx_cli_preserves_preload_order_program_arguments_and_early_rejections.
 * @evidence contracts/e2e.md#necessary-boundary Parsed preloads and tail arrays must reach Node's real require and child argv channels in order; direct parsing cannot detect dropping values between projection and spawn or failing to transport child cwd/environment and execute the marker write.
 * @evidence contracts/e2e.md#shared-execution The original six preload runs and separate argv/preload-tail, entry-side-effect and explicit-cwd hosts share one project preparation and one process lifetime; different token shapes now execute through the actual parser unit rather than repeating equivalent compiler emit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shell starts in the parent while the child runs in the distinct app fixture; a fixture-owned marker observes actual inherited env, argv and cwd. Unique preload paths each execute once in a fresh host; the unrequested post-entry module is separate, and the launcher owns run cleanup. No changed-source or cold-cache transition is collapsed.
 * @evidence contracts/e2e.md#preserved-coverage Ordered preloads, ENTRY execution, loaded global, exact program argv, real marker side effects/env transport, explicit child cwd different from shell cwd, terminal/build/watch forwarding, no compiler-option diagnostic and the absent post-entry effect remain observable here; every original spelling/separator/error decision has direct launcher-parser unit ownership.
 */
export function test_ttsx_preloads_every_require_spelling_before_the_entry() {
    const parent = TestProject.tmpdir("preload-cwd-parent-");
    const root = path.join(parent, "app");
    TestProject.writeFiles(root, {
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "a.cjs": `globalThis.__ttsxPreload = "loaded"; console.log("PRELOAD a.cjs");\n`,
      "b.cjs": `console.log("PRELOAD b.cjs");\n`,
      "a.ts": `console.log("PRELOAD a.ts");\n`,
      "c.tsx": `console.log("PRELOAD c.tsx");\n`,
      "after.cjs": `console.log("UNEXPECTED POST-ENTRY PRELOAD");\n`,
      "src/main.ts": `declare const process: { argv: string[]; cwd(): string; env: { TTSX_MARKER?: string } }; declare function require(name: string): { writeFileSync(file: string, text: string): void }; const marker = process.env.TTSX_MARKER; if (!marker) throw new Error("missing marker path"); require("node:fs").writeFileSync(marker, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), executed: true })); console.log(JSON.stringify({ entry: "ENTRY", preload: (globalThis as Record<string, unknown>).__ttsxPreload, argv: process.argv.slice(2) }));\n`,
    });

    const compilerFlags = ["--pretty", "--target", "es2020", "--module", "commonjs"];
    const flags = ["--require=./a.ts", "-r=./a.cjs", "-r", "./c.tsx", "--require", "./b.cjs"];
    const tail = ["generate", "--input", "X", "--output", "Y", "--help", "-h", "--version", "-v", "--watch", "--build", "-r", "./after.cjs", "a", "--", "b", "--mode", "probe", "alpha", "beta"];
    const marker = path.join(root, "runner-marker.json");
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, ...compilerFlags, ...flags, "src/main.ts", "--", ...tail], { cwd: parent, env: { TTSX_MARKER: marker } });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /entry file is required|Unknown compiler option|UNEXPECTED POST-ENTRY PRELOAD/i);
    const lines = result.stdout.trim().split(/\r?\n/);
    assert.deepEqual(lines.slice(0, -1), ["PRELOAD a.ts", "PRELOAD a.cjs", "PRELOAD c.tsx", "PRELOAD b.cjs"]);
    assert.deepEqual(JSON.parse(lines.at(-1)!), { entry: "ENTRY", preload: "loaded", argv: tail });
    const record = JSON.parse(fs.readFileSync(marker, "utf8"));
    assert.deepEqual(record, { argv: tail, cwd: fs.realpathSync(root), executed: true });
    assert.equal(path.basename(record.cwd), "app");

}