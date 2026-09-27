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
 * both directions, so each is answered once per process by a probe through the
 * same public API: a hook registered only for the probe, and removed after.
 * Both probes run before the runtime's own hooks exist, so nothing they load is
 * recorded as an input of the program.
 */
export namespace RuntimeLoaderCapabilities {
  /**
   * Whether `require.resolve` consults resolve hooks registered with
   * `module.registerHooks`.
   *
   * A runtime whose `require.resolve` does consult them resolves a TypeScript
   * source through ttsx's own resolve hook; one that does not answers from
   * Node's resolver alone, which knows no TypeScript source.
   */
  export function requireResolveConsultsHooks(): boolean {
    requireResolve ??= probeRequireResolve();
    return requireResolve;
  }

  /**
   * Whether the namespace of a CommonJS module imported from ESM carries a
   * `module.exports` export beside `default` and the statically detected
   * names.
   */
  export function commonJsNamespaceCarriesModuleExports(): boolean {
    moduleExportsKey ??= probeModuleExportsKey();
    return moduleExportsKey;
  }

  /**
   * Whether a CommonJS module the ESM loader evaluates from source a load hook
   * returned keeps Node's ordinary `require`.
   *
   * A runtime that does not (Node 22) evaluates it with a narrower `require`:
   * no `cache`, `extensions`, or `resolve.paths`, whose calls go through the
   * ESM loader and cannot load a module Node's CommonJS loader would load.
   * Whenever any load hook is registered, every CommonJS module an `import`
   * reaches takes that path there, the ones the hook passes to `nextLoad`
   * included (samchon/ttsc#1570).
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
   * synchronous `require()` of an ES module loads its CommonJS dependencies
   * through the CommonJS loader on every release, so it cannot tell the two
   * runtimes apart. The import runs in a worker thread, with hooks of its own
   * that answer only the probe's two virtual modules, while this thread waits
   * for its answer.
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
    // then uses gives a CommonJS module Node's own `require` on every release,
    // so a probe that could not answer costs nothing but the facade.
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
 * How long the probe waits for its worker. A worker starts in tens of
 * milliseconds; the bound only keeps a wedged worker from hanging the program.
 */
const HOOKED_COMMONJS_REQUIRE_PROBE_TIMEOUT_MS = 10_000;

/**
 * The worker body of `probeHookedCommonJsRequire`: an ES module importing a
 * CommonJS module that reports whether its `require` is Node's ordinary one,
 * both served from source by the worker's own hooks. It stores 1 when kept, 2
 * when narrowed, and 3 when the import failed.
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
