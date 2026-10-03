import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin resolution: a TypeScript barrel descriptor entry that
 * re-exports sibling modules loads through ttsx.
 *
 * Locks the ttsx fallback in `loadProjectPlugins.ts::loadDescriptorViaTtsx`. A
 * plugin may ship as a `.ts` package whose `transform` entry is a barrel
 * (`export * from "./runtime"` plus the factory) — Node's loader cannot follow
 * the extensionless relative imports, so ttsc runs the entry through `ttsx
 * --no-plugins` to suppress descriptor plugin recursion and extracts the
 * descriptor it produces. This body observes the resulting emit;
 * it does not independently capture fallback argv or prove zero Go builds
 * during descriptor evaluation.
 *
 * 1. A `node_modules/barrel-plugin` package (`.ts` ESM source with its own
 *    tsconfig) whose `transform` is the barrel `index.ts` re-exporting
 *    `./runtime` and the `./descriptor` factory.
 * 2. Run ttsc with `--emit` against a project that depends on it.
 * 3. Assert zero exit and that the descriptor's transform ran (`"BARREL:plugin"`
 *    in the emit), proving the barrel loaded through ttsx.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises TypeScript barrel fallback through the ttsx descriptor evaluator; asserts zero exit and literal BARREL:plugin output, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins the extensionless sibling barrel input and resulting transform; supported fallback uses --no-plugins, but this body does not independently capture every child argv or count recursive plugin builds; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_ts_barrel_descriptor_entry_loads_through_ttsx entry executes from native-plugins/corpus-misc in the selected E2E population; it invokes the actual launcher and selected native transformer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is TypeScript barrel fallback through the ttsx descriptor evaluator; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Valid shared reuse requires equivalent source, toolchain and host inputs; available cache does not certify measured hits, total builds/processes or minimum preparation. Initial output absence and a direct returned command precede output reads; arbitrary descendants or loaded-image equality are not certified. TestProject owns consumer cleanup at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit and literal BARREL:plugin output with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_ts_barrel_descriptor_entry_loads_through_ttsx() {
  const root = commonJsProject(FixtureFiles.read("ttsc/plugin_ts_barrel_descriptor_entry_loads_through_ttsx/inputs-1"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: { "barrel-plugin": "0.1.0" },
    }),
  );

  const pkg = path.join(root, "node_modules", "barrel-plugin");
  fs.mkdirSync(path.join(pkg, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(pkg, "package.json"),
    JSON.stringify({
      name: "barrel-plugin",
      version: "0.1.0",
      type: "module",
      main: "./src/index.ts",
      ttsc: {
        plugin: {
          transform: "barrel-plugin",
          name: "prefix",
          prefix: "BARREL:",
        },
      },
    }),
  );
  fs.writeFileSync(
    path.join(pkg, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        skipLibCheck: true,
        target: "es2022",
      },
      include: ["src"],
    }),
  );
  // Barrel entry: re-exports a sibling runtime and the descriptor factory
  // through extensionless relative imports — the shape Node cannot load and
  // ttsc must hand to ttsx.
  fs.writeFileSync(
    path.join(pkg, "src", "index.ts"),
    `export * from "./runtime";\nexport { default } from "./descriptor";\n`,
  );
  fs.writeFileSync(
    path.join(pkg, "src", "runtime.ts"),
    `export interface Marker {\n  readonly tag: "barrel";\n}\nexport const RUNTIME_TAG = "barrel-runtime";\n`,
  );
  fs.writeFileSync(
    path.join(pkg, "src", "descriptor.ts"),
    `import path from "node:path";

export default (context: { plugin: { name: string }; dirname: string }) => ({
  name: context.plugin.name,
  source: ${JSON.stringify(nativePluginSource())},
});
`,
  );

  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /"BARREL:plugin"/);
}
