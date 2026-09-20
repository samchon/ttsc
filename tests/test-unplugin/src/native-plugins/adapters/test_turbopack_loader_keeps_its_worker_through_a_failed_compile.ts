import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies a development session reports a failed compile through the loader
 * context's error channel and hands Turbopack a module that throws it, rather
 * than failing the loader run (samchon/ttsc#1458).
 *
 * Turbopack discards a worker whose loader run failed and starts a fresh one
 * for the next run, so a compile that failed once cost every module of the
 * project, in every layer, a cold worker of its own: on the macOS x64 platform
 * lane the broken page never answered within the dev server's own limit. The
 * loader context's `emitError` reports the same error as an issue while the run
 * succeeds, and the module it returns throws the message when evaluated, so the
 * page fails the same way and the worker lives on. A context without the
 * channel, and a one-shot build, fail the run as before.
 *
 * Only the compiler's verdict on the project's state is delivered that way, a
 * compile that ended in diagnostics or in an exception it reported: it holds
 * until an input changes, and a change re-runs the module. Any other failure,
 * an adapter error before any compile or a generation the adapter could not
 * capture while its inputs kept changing, says nothing about the state, and a
 * module kept on it would never run again; measured on the macOS package
 * contract, where an edit landing after the loader returned left the page on
 * that error for good. Such a run fails, so Turbopack runs the module again on
 * its next request.
 *
 * 1. Run the loader on a module whose plugin fails, with a context that offers
 *    `emitError`, and assert the error is emitted once and the returned module
 *    throws its message.
 * 2. Run it with a context without `emitError`, and assert the run fails with the
 *    same error.
 * 3. Run it with a project option that names no config, with `emitError` offered,
 *    and assert the run fails and nothing is emitted.
 */
export async function test_turbopack_loader_keeps_its_worker_through_a_failed_compile(): Promise<void> {
  const root = TestUnpluginProject.createProject({
    plugins: [{ transform: "./plugin.cjs", operation: "read-helper" }],
  });
  const props = {
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  };

  const emitted = await runTurbopackLoaderWithContext({
    ...props,
    emitErrors: true,
  });
  assert.equal(emitted.emitted.length, 1, "the failure is emitted once");
  assert.match(emitted.emitted[0]!.message, /helper\.ts/);
  assert.match(emitted.content, /^throw new Error\(/);
  assert.equal(
    new Function(emitted.content) instanceof Function,
    true,
    "the module is a program",
  );
  assert.throws(
    () => new Function(emitted.content)(),
    (error: unknown) =>
      error instanceof Error && error.message === emitted.emitted[0]!.message,
    "the module throws the emitted error",
  );

  await assert.rejects(
    runTurbopackLoaderWithContext(props),
    /helper\.ts/,
    "a context without the channel fails the run",
  );

  const missing = path.join(root, "absent", "tsconfig.json");
  const failed = await runTurbopackLoaderWithContext({
    ...props,
    emitErrors: true,
    options: { project: missing },
  }).then(
    () => undefined,
    (error: unknown) => error,
  );
  assert.ok(
    failed instanceof Error,
    "a failure that is no compile verdict fails the run",
  );
  assert.doesNotMatch(
    failed.message,
    /helper\.ts/,
    "the run failed before any compile",
  );
}
