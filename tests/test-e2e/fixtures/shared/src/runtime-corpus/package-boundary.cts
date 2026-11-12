declare const __dirname: string;
declare const require: {
  (specifier: string): any;
  resolve(specifier: string, options: { paths: string[] }): string;
};

/** Load installed and physical workspace sources through this real CJS parent. */
export async function observePackageBoundary(): Promise<unknown> {
  const path = require("node:path");
  const { pathToFileURL } = require("node:url");
  const app = path.resolve(__dirname, "../../tools/runtime-package-boundary/app");
  const observed: Record<string, unknown> = {};
  const failures: unknown[] = [];
  for (const [label, specifier] of [
    ["configless", "boundary-no-config"],
    ["esm", "boundary-no-config/esm"],
    ["own", "boundary-own"],
    ["workspace", "boundary-workspace"],
  ]) {
    try {
      const resolved = require.resolve(specifier!, { paths: [app] });
      const loaded = label === "esm" ? await import(pathToFileURL(resolved).href) : require(resolved);
      if (label === "own") {
        const other = require(require.resolve("boundary-own/other", { paths: [app] }));
        observed.own = { consumer: loaded.consumer, own: loaded.own, identity: other.token === loaded.token };
      } else {
        observed[label!] = loaded.value;
        if (label === "configless") observed.repeated = require(resolved) === loaded;
      }
    } catch (error) {
      failures.push({ label, code: (error as any).code ?? null, message: String((error as any).message) });
    }
  }
  // The same request from lookup paths without the package must not find it:
  // `paths` reaches Node's own resolution but no resolve hook, so a hook that
  // reused the answer above would return the wrong module.
  try {
    require.resolve("boundary-no-config", { paths: [__dirname] });
    observed.scoped = false;
  } catch (error) {
    observed.scoped = (error as any).code === "MODULE_NOT_FOUND";
  }
  return { ...observed, failures };
}
