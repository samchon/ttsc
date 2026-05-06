import fs from "node:fs/promises";
import type { UnpluginContextMeta } from "unplugin";

import { unplugin } from "./api.js";
import type { TtscUnpluginOptions } from "./core/options.js";

export interface BunLikePlugin {
  name: string;
  setup(build: BunLikeBuild): void | Promise<void>;
}

export interface BunLikeBuild {
  onLoad(
    options: { filter: RegExp },
    loader: (args: { path: string }) => Promise<{ contents: string }>,
  ): void;
}

const sourceFilePattern = /\.[cm]?[jt]sx?$/;

export default function bun(options?: TtscUnpluginOptions): BunLikePlugin {
  return {
    name: "ttsc-unplugin",
    setup(build) {
      const raw = unplugin.raw(options, {} as UnpluginContextMeta);
      build.onLoad({ filter: sourceFilePattern }, async (args) => {
        const source = await fs.readFile(args.path, "utf8");
        const result =
          typeof raw.transform === "function"
            ? await raw.transform.call({} as never, source, args.path)
            : undefined;
        if (typeof result === "string") {
          return { contents: result };
        }
        if (
          typeof result === "object" &&
          result !== null &&
          "code" in result &&
          typeof result.code === "string"
        ) {
          return { contents: result.code };
        }
        return { contents: source };
      });
    },
  };
}
