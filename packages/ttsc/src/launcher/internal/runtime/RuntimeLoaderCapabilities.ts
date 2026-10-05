import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

/**
 * What this runtime's module loader does on its own, read by asking it rather
 * than by its version.
 *
 * The ttsx runtime serves TypeScript through `module.registerHooks`, the
 * supported customization API. How far that API reaches, and how the loader
 * shapes a CommonJS module imported from ESM, differ between Node releases in
 * both directions, so this helper instance memoizes actual public-API probes.
 * Main-thread temporary hooks deregister afterwards; the separate worker owns
 * its hooks until termination. The runtime installer invokes these before its
 * own hooks exist, so nothing they load is recorded as an input of the
 * program.
 *
 * @evidence contracts/common.md#principled-implementation Public loader probes observe the actual require.resolve, namespace and hooked-import behavior instead of deriving it from a release number; each boolean selects the runtime path matching that observed capability.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns three independent lazy capability answers and their private probes, keeping loader adaptation choices with the hook consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Temporary registerHooks/deregister boundaries are supported customization, not private-loader mutation; the worker tests a real ESM-to-CommonJS path rather than a fixture version table.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why loader differences require observation and describe each affected behavior; worker comments distinguish synchronous require from the probed import path.
 * @evidence contracts/portability.md#os-neutral-implementation Native filenames become URLs through pathToFileURL and workers use Node APIs; no shell quoting, separator substitution or OS-name case rule implements the probes.
 * @evidence contracts/performance.md#efficient-algorithms Three memoized probe paths delegate native resolution/module loading or Worker initialization; input path text, loader work and startup latency are not bounded by the fixed probe count. Atomics waits at most ten seconds after worker construction; that wait is not a bound on constructor or teardown latency.
 * @evidence contracts/performance.md#reuse-equivalent-work Completed booleans serve this helper instance under the installer's stable native-loader premise; arbitrary later external hook changes are not re-probed. Propagated exceptions leave initialization unset; worker construction/failure/no-answer paths can instead memoize conservative false.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Three booleans remain with this helper instance. Main-thread temporary hooks deregister in finally; the probe namespace/cache belongs to Node. Worker termination is requested asynchronously after the answer wait, so completed teardown and release of its hooks/streams are not certified by return.
 */
export namespace RuntimeLoaderCapabilities {
  /**
   * Whether `require.resolve` consults resolve hooks registered with
   * `module.registerHooks`.
   *
   * A runtime whose `require.resolve` does consult them resolves a TypeScript
   * source through ttsx's own resolve hook; one that does not answers from
   * Node's resolver alone, which knows no TypeScript source.
   *
   * @evidence contracts/common.md#principled-implementation A sentinel request through require.resolve observes whether the public resolve hook was actually consulted, giving the consumer grounds for its corresponding resolution lane.
   * @evidence contracts/common.md#clear-and-simple-design The public accessor exposes one cached capability while a private probe owns registration and cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No private Node resolver is patched and no version-specific expected answer replaces the actual supported-hook observation.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish hook-aware and native-only resolution and explain why the distinction affects TypeScript sources.
   * @evidence contracts/portability.md#os-neutral-implementation The probe uses a native filename converted with pathToFileURL; Node supplies synchronous module resolution on each supported host.
   * @evidence contracts/performance.md#efficient-algorithms One sentinel request through temporary public hooks initializes the boolean; path text and delegated native resolution are initialization costs. Later calls read the helper-instance memo without another registration.
   * @evidence contracts/performance.md#reuse-equivalent-work requireResolve stores the running loader's stable capability for subsequent consumers; a thrown probe does not store an invented answer.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The temporary hook deregisters in finally; this helper instance retains the boolean. Node and the surrounding installed runtime own any delegated module/cache state.
   */
  export function requireResolveConsultsHooks(): boolean {
    requireResolve ??= probeRequireResolve();
    return requireResolve;
  }

  /**
   * Whether the namespace of a CommonJS module imported from ESM carries a
   * `module.exports` export beside `default` and the statically detected
   * names.
   *
   * @evidence contracts/common.md#principled-implementation Importing the side-effect-free CommonJS probe through public hooks observes whether the actual ESM namespace contains module.exports, so facade shape follows the running loader.
   * @evidence contracts/common.md#clear-and-simple-design The accessor exposes only the namespace capability, with source construction and temporary hooks isolated in its private probe.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A real namespace is inspected rather than fabricating the export from a Node version or modifying CommonJS globals.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes module.exports from default and static names, which is the fact facade callers need.
   * @evidence contracts/portability.md#os-neutral-implementation path.join and pathToFileURL preserve native probe filenames and URL spelling; no hand-built file URL assumes drive or separator syntax.
   * @evidence contracts/performance.md#efficient-algorithms One hooked importer delegates native CommonJS/ESM loading and namespace-key enumeration, including native path text and loader work; later calls read this helper-instance memo.
   * @evidence contracts/performance.md#reuse-equivalent-work The namespace convention is stable for the running loader, so the cached boolean is shared by all facades; failed probing propagates rather than guessing the convention.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The temporary hook deregisters in finally. The helper retains its boolean; Node owns the probe CommonJS/ESM cache entries, which are not explicitly evicted here.
   */
  export function commonJsNamespaceCarriesModuleExports(): boolean {
    moduleExportsKey ??= probeModuleExportsKey();
    return moduleExportsKey;
  }

  /**
   * Whether a CommonJS module the ESM loader evaluates from source a load hook
   * returned exposes `require.cache` and `require.extensions` as objects.
   *
   * A runtime that does not (Node 22) evaluates it with a narrower `require`:
   * no `cache`, `extensions`, or `resolve.paths`, whose calls go through the
   * ESM loader and cannot load a module Node's CommonJS loader would load.
   * Whenever any load hook is registered, every CommonJS module an `import`
   * reaches takes that path there, the ones the hook passes to `nextLoad`
   * included.
   *
   * @evidence contracts/common.md#principled-implementation A worker runs an actual ESM import whose hooked CommonJS body observes cache/extensions object properties; only that positive result permits the caller's unadapted lane. This does not independently test every require method or arbitrary CommonJS dependency.
   * @evidence contracts/common.md#clear-and-simple-design The synchronous accessor hides worker coordination and returns one cached loader capability rather than exposing timing or worker state to hook consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The probe registers supported hooks in its own worker and preserves public createRequire adaptation on uncertain results instead of replacing Node internals.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain narrowed require and why passthrough CommonJS imports are affected; private prose identifies the required asynchronous import path.
   * @evidence contracts/portability.md#os-neutral-implementation Node workers and pathToFileURL handle the native execution boundary without process shell commands or platform-specific loader guesses.
   * @evidence contracts/performance.md#efficient-algorithms Worker construction delegates native thread/startup work; one four-byte shared answer and a bounded Atomics wait coordinate this attempt. Repeated accessor calls read the helper-instance memo, including cached conservative negatives, without another worker.
   * @evidence contracts/performance.md#reuse-equivalent-work The running Node loader's require behavior is shared across imports; a conservative negative result after failure consistently selects the facade that supplies ordinary require.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One worker belongs to initialization and receives terminate in finally; one boolean remains afterwards. The synchronous accessor does not await termination, so completion of teardown is not independently bounded here.
   */
  export function hookedCommonJsImportKeepsRequire(): boolean {
    hookedCommonJsRequire ??= probeHookedCommonJsRequire();
    return hookedCommonJsRequire;
  }

  let requireResolve: boolean | undefined;
  let moduleExportsKey: boolean | undefined;
  let hookedCommonJsRequire: boolean | undefined;

  /**
   * Ask the runtime by running the path that narrows `require`: an `import()`,
   * whose CommonJS dependency the ESM loader evaluates from a hook's source. A
   * synchronous `require()` path is not the asynchronous import path whose
   * behavior this probe asks about. The import runs in a worker thread with
   * hooks of its own that answer only the probe's two virtual modules, while
   * this thread waits for its answer.
   */
  function probeHookedCommonJsRequire(): boolean {
    const answer = new Int32Array(new SharedArrayBuffer(4));
    let worker: Worker;
    try {
      worker = new Worker(HOOKED_COMMONJS_REQUIRE_PROBE, {
        eval: true,
        stderr: true,
        stdout: true,
        workerData: answer,
      });
    } catch {
      return false;
    }
    try {
      Atomics.wait(answer, 0, 0, HOOKED_COMMONJS_REQUIRE_PROBE_TIMEOUT_MS);
    } finally {
      void worker.terminate();
    }
    // Anything but a "kept" answer counts as narrowed: the facade the runtime
    // then uses supplies the supported public createRequire adaptation,
    // while worker startup and requested termination remain separate costs.
    return answer[0] === 1;
  }

  function probeRequireResolve(): boolean {
    const sentinel = `./.ttsc-require-resolve-probe-${process.pid}`;
    let consulted = false;
    const probe = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier !== sentinel) return nextResolve(specifier, context);
        consulted = true;
        return { shortCircuit: true, url: pathToFileURL(__filename).href };
      },
    });
    try {
      require.resolve(sentinel);
    } catch {
      // A runtime that never consulted the hook refuses the sentinel.
    } finally {
      probe.deregister();
    }
    return consulted;
  }

  function probeModuleExportsKey(): boolean {
    const module = path.join(__dirname, "interopProbe.js");
    const importer = path.join(
      __dirname,
      `.ttsc-interop-probe-${process.pid}.mjs`,
    );
    const importerUrl = pathToFileURL(importer).href;
    const probe = registerHooks({
      resolve(specifier, context, nextResolve) {
        return specifier === importer || specifier === importerUrl
          ? { shortCircuit: true, url: importerUrl }
          : nextResolve(specifier, context);
      },
      load(url, context, nextLoad) {
        return url === importerUrl
          ? {
              format: "module",
              shortCircuit: true,
              source: `import * as namespace from ${JSON.stringify(pathToFileURL(module).href)};\nexport default Object.keys(namespace);\n`,
            }
          : nextLoad(url, context);
      },
    });
    // A probe that fails says nothing about the shape, so it is not guessed.
    try {
      const keys = (require(importer) as { default: unknown }).default;
      return Array.isArray(keys) && keys.includes("module.exports");
    } finally {
      probe.deregister();
    }
  }
}

/**
 * How long the probe waits for its worker. No startup latency is guaranteed;
 * the answer wait is ten seconds after construction and does not bound worker
 * creation or completed termination.
 */
const HOOKED_COMMONJS_REQUIRE_PROBE_TIMEOUT_MS = 10_000;

/**
 * The worker body of `probeHookedCommonJsRequire`: an ES module importing a
 * CommonJS module that reports whether cache/extensions are objects, both
 * served from source by the worker's own hooks. It stores 1 when kept, 2 when
 * narrowed, and 3 when the import failed.
 */
const HOOKED_COMMONJS_REQUIRE_PROBE = `
const { workerData } = require("node:worker_threads");
const { registerHooks } = require("node:module");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const base = path.join(__dirname, ".ttsc-hooked-require-probe-" + process.pid);
const importer = pathToFileURL(base + ".mjs").href;
const moduleUrl = pathToFileURL(base + ".cjs").href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === importer) return { shortCircuit: true, url: importer };
    if (specifier === moduleUrl || specifier === base + ".cjs")
      return { shortCircuit: true, url: moduleUrl };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === importer)
      return { format: "module", shortCircuit: true, source: "import kept from " + JSON.stringify(moduleUrl) + ";\\nexport default kept;\\n" };
    if (url === moduleUrl)
      return { format: "commonjs", shortCircuit: true, source: "module.exports = typeof require.cache === 'object' && typeof require.extensions === 'object';\\n" };
    return nextLoad(url, context);
  },
});
const answer = (value) => {
  Atomics.store(workerData, 0, value);
  Atomics.notify(workerData, 0);
};
import(importer).then((namespace) => answer(namespace.default === true ? 1 : 2), () => answer(3));
`;
