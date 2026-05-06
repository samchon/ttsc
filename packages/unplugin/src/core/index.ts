import type { UnpluginFactory, UnpluginInstance } from "unplugin";
import { createUnplugin } from "unplugin";

import type { TtscUnpluginOptions } from "./options";
import { resolveOptions } from "./options";
import { isDeclarationFile, stripQuery, transformTtsc } from "./transform";

const name = "ttsc-unplugin";
const sourceFilePattern = /\.[cm]?[jt]sx?$/;
const nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;
const virtualModulePattern = /\0/;

const unpluginFactory: UnpluginFactory<
  TtscUnpluginOptions | undefined,
  false
> = (rawOptions = {}) => {
  const options = resolveOptions(rawOptions);
  let aliases: unknown;

  return {
    name,
    enforce: "pre",

    vite: {
      configResolved(config) {
        aliases = config.resolve.alias;
      },
    },

    transformInclude(id) {
      const file = stripQuery(id);
      return isTransformTarget(file);
    },

    async transform(source, id) {
      const file = stripQuery(id);
      if (!isTransformTarget(file)) {
        return undefined;
      }
      return transformTtsc(file, source, options, aliases);
    },
  };
};

const unplugin: UnpluginInstance<TtscUnpluginOptions | undefined, false> =
  createUnplugin(unpluginFactory);

export type {
  TtscUnpluginCompilerOptionsJson,
  TtscUnpluginOptions,
} from "./options";
export { resolveOptions, transformTtsc, unplugin };

export default unplugin;

function isTransformTarget(id: string): boolean {
  return (
    sourceFilePattern.test(id) &&
    !virtualModulePattern.test(id) &&
    !isDeclarationFile(id) &&
    !nodeModulesPattern.test(id)
  );
}
