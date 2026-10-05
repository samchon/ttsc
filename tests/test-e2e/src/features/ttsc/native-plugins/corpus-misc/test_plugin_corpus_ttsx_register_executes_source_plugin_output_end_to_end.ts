import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import {
  MOCHA_BIN,
  TTSX_REGISTER,
  linkTtscPackage,
} from "../../../../internal/ttsc/internal/ttsx-register";

/**
 * Verifies plugin corpus: ttsx register executes source plugin output.
 *
 * Plain TypeScript execution cannot prove the preload reused ttsx's compiler
 * preparation. This fixture's Go-source transform rewrites the runtime value,
 * while real Mocha loads that root from outside the project's `include`, so its
 * output pins the complete fallback, plugin build, and transformed-emit path.
 *
 * 1. Copy the native Go-source plugin fixture and add an excluded entry root.
 * 2. Load it through real Mocha with `--require ttsc/register`.
 * 3. Assert the transformed uppercase value is the code that executes.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Mocha preloads the built workspace-linked register hook and executes an excluded TypeScript entry transformed by the actual Go compiler fixture, requiring zero exit and uppercase PLUGIN output.
 * @evidence contracts/testing.md#independent-expectations The excluded entry calls goUpper on lowercase plugin; literal uppercase stdout independently establishes native transformation and selection of the synthetic-entry output.
 * @evidence contracts/testing.md#distinguishing-cases Owns the preload's excluded-root fallback and synthetic compiler tsconfig connection, distinct from the direct ttsx in-include boundary.
 * @evidence contracts/testing.md#execution-ownership This named native export owns one consumer project and real Mocha process, selected once by the native boundary runner.
 * @evidence contracts/e2e.md#necessary-boundary Direct runtime decisions cannot prove Mocha's preload reaches compiler-backed plugin emission for a source outside include; the actual hook, synthetic tsconfig and successful Node output are required.
 * @evidence contracts/e2e.md#shared-execution The canonical immutable compiler-backed Go producer reads its supplied synthetic tsconfig directly and selects the same suite TTSC_CACHE_DIR as other runtime consumers, avoiding a copied Go module here. Cache-hit/build/process counts and executable-byte reuse are not measured; the linked workspace register is not packed-install certification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The excluded entry and consumer module links belong to the temporary project; the original uppercase runtime output observes selection of transformed code, not a complete provenance table or every synthetic-config field. Direct command return precedes stdout inspection but does not certify arbitrary descendants or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Keeps original exit and exact uppercase-line output assertions, the outside-include input and real Mocha preload; these observations do not certify historical helper removal or every synthetic-file/rootDir detail. Any portable configuration meaning and actual boundary survival remain separate obligations before donor removal.
 */
export function test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end(): void {
  const root = copyProject("go-source-plugin");
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `module.exports = () => ({ name: "go-source-plugin", capabilities: { emitProvenance: true }, source: ${JSON.stringify(nativePluginSource("runtime-source"))} });\n`,
  );
  linkTtscPackage(root);
  const testDir = path.join(root, "test");
  fs.mkdirSync(testDir);
  fs.writeFileSync(
    path.join(testDir, "main.ts"),
    [
      `export const value: string = goUpper("plugin");`,
      `console.log(value);`,
      "",
    ].join("\n"),
    "utf8",
  );
  const result = spawn(
    process.execPath,
    [
      MOCHA_BIN,
      "--require",
      TTSX_REGISTER,
      "--extension",
      "ts",
      "test/main.ts",
    ],
    {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PLUGIN$/m);
}
