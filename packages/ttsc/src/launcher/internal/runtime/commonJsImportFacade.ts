/**
 * The ESM source that stands in for a CommonJS module an ESM `import` reaches.
 *
 * Node evaluates a CommonJS module handed to its ESM loader with source on a
 * path where the module's own `require()` does not reach `module.registerHooks`
 * on every supported release, so a nested `require("./x.js")` backed only by
 * `x.ts` failed there (samchon/ttsc#1281, samchon/ttsc#1517). The facade loads
 * the module through the CommonJS loader instead, with a `require` from
 * `createRequire`, whose resolution and loading the hooks serve on every
 * release, and gives the importer the namespace Node would have: `default` as
 * `module.exports`, `module.exports` itself where the runtime exports it, and
 * each statically detected name read from `module.exports` once the module has
 * run. The module is evaluated where the importer's graph evaluates it, and
 * once, in the same module cache a `require()` of it uses.
 *
 * @param url The module's URL, which its `require` resolves from.
 * @param filename The module's path, which the CommonJS loader loads.
 * @param names The names Node's static export detection finds for it.
 * @param moduleExportsKey Whether the runtime's namespace carries
 *   `module.exports`.
 */
export function commonJsImportFacade(
  url: string,
  filename: string,
  names: readonly string[],
  moduleExportsKey: boolean,
): string {
  const lines = [
    `import { createRequire as __ttscCreateRequire } from "node:module";`,
    `const __ttscModule = __ttscCreateRequire(${JSON.stringify(url)})(${JSON.stringify(filename)});`,
    `export default __ttscModule;`,
  ];
  if (moduleExportsKey)
    lines.push(`export { __ttscModule as "module.exports" };`);
  [...new Set(names)]
    .filter((name) => name !== "default" && name !== "module.exports")
    .forEach((name, index) => {
      lines.push(
        `const __ttscExport${index} = __ttscModule[${JSON.stringify(name)}];`,
        `export { __ttscExport${index} as ${JSON.stringify(name)} };`,
      );
    });
  return `${lines.join("\n")}\n`;
}
