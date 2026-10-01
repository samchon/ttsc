import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeSharedCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transformAsync runs its worker thread under the
 * compiler's `env`, the way it runs its child processes.
 *
 * A bundler adapter gives each compile a scratch directory by handing the
 * compiler an `env` whose `TEMP`, `TMP`, and `TMPDIR` name it. The worker
 * thread used to adopt the caller's `process.env` alone, so the transform's own
 * temporary directories ignored that `env`, and the adapter rewrote the host
 * process's globals around the call to reach them (samchon/ttsc#1488). The
 * worker now takes the caller's environment with the compiler's `env` merged
 * over it, as every child process already did.
 *
 * 1. Transform a project with a native plugin under an `env` whose temporary
 *    directory is a regular file, below which no directory can be created.
 * 2. Assert the transform fails naming that file: the worker's capture of the
 *    plugin's output follows the `env`.
 * 3. Assert the same project transforms under the caller's own environment.
 *
 * @evidence contracts/testing.md#behavioral-verification transformAsync rejects an invalid scoped temp parent naming its physical file while plain execution succeeds.
 * @evidence contracts/testing.md#independent-expectations context.env owns worker temporary storage independently of ambient process.env; the fixture producer's explicit output is input to the host contract rather than an oracle for compiler AST semantics.
 * @evidence contracts/testing.md#distinguishing-cases a regular file as scoped temp parent contrasts with the same project under the valid ambient environment.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsccompiler_transformasync_runs_its_worker_under_the_compilers_env function is an API E2E entry under src/features/api; it executes worker environment capture, native producer output capture and asynchronous API exception classification.
 * @evidence contracts/e2e.md#necessary-boundary This case owns worker environment capture, native producer output capture and asynchronous API exception classification; direct decoder or option calls cannot prove this assembly and caller-visible behavior.
 * @evidence contracts/e2e.md#shared-execution Five API consumers share one process-owned immutable compiler producer source and its keyed binary. Private descriptors, projects and API instances retain each case's inputs; source-mutation, proof-path and cold-cache cases keep their isolated producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared Go bytes never change in these five consumers; the product validates source, SDK and environment keys before artifact reuse. Each descriptor and project is private, and both awaited worker results settle before the fixture can be released. TestProject retains the immutable source until process exit and cleans it on exit.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and counterexample below remains; only source preparation is shared, and the native envelope decoder matrix executes separately in source units.
 */
export async function test_ttsccompiler_transformasync_runs_its_worker_under_the_compilers_env() {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeSharedCompilerPlugin(root);
    const notADirectory = path.join(root, "temp-is-a-file");
    fs.writeFileSync(notADirectory, "", "utf8");

    const scoped = await new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TEMP: notADirectory, TMP: notADirectory, TMPDIR: notADirectory },
    }).transformAsync();
    assert.equal(scoped.type, "exception");
    if (scoped.type !== "exception") throw new Error("unreachable");
    assert.match(
      (scoped.error as Error).message,
      /temporary directory parent is not a directory/,
    );
    assert.ok(
      (scoped.error as Error).message.includes(
        fs.realpathSync.native(notADirectory),
      ),
      (scoped.error as Error).message,
    );

    const plain = await new TtscCompiler({
      binary: tsgo,
      cwd: root,
    }).transformAsync();
    assert.equal(plain.type, "success");
}
