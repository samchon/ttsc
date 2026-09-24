import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeCompilerPlugin,
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
 */
export const test_ttsccompiler_transformasync_runs_its_worker_under_the_compilers_env =
  async () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeCompilerPlugin(root);
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
  };
