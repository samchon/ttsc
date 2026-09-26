import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

  let requireResolve: boolean | undefined;
  let moduleExportsKey: boolean | undefined;

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
