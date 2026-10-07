// @ts-ignore The native host supplies Node's module builtin without enrolled Node types.
import { createRequire } from "node:module";

/** Observe the original ESM global-loader and three shadowed binding results. */
export async function observeRequireBindings(): Promise<string[]> {
  const globals = globalThis as unknown as { require?: unknown };
  const previous = Object.getOwnPropertyDescriptor(globals, "require");
  // @ts-ignore Native ImportMeta.url is supplied by this actual Node module.
  globals.require = createRequire(new URL("./require-shadow/loader.js", import.meta.url));
  try {
    const parameter = await import("./require-shadow/parameter.js");
    const local = await import("./require-shadow/local.js");
    const imported = await import("./require-shadow/imported.js");
    const loader = await import("./require-shadow/loader.js");
    const unbound = await import("./require-shadow/unbound.js");
    return [parameter.value((id: string) => id), local.value(), imported.value, loader.loaded, unbound.loaded];
  } finally {
    if (previous) Object.defineProperty(globals, "require", previous);
    else delete globals.require;
  }
}
