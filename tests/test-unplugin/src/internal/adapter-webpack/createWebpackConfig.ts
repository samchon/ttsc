import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import path from "node:path";
import type { Configuration } from "webpack";

/**
 * Webpack configuration matching the field report: filesystem cache (what
 * Next.js persists under `.next/cache`) with hash-based snapshots so the
 * scenario does not depend on filesystem timestamp resolution. The cache
 * directory lives under `.cache/` so the transform's own project re-hash walk
 * ignores it, and output goes to `out/` for the same reason.
 */
export async function createWebpackConfig(
  root: string,
): Promise<Configuration> {
  const unpluginWebpack =
    await TestUnpluginRuntime.loadUnpluginAdapter("webpack");
  return {
    context: root,
    mode: "development",
    devtool: false,
    entry: TestUnpluginProject.mainFile(root),
    output: {
      path: path.join(root, "out"),
      filename: "bundle.js",
    },
    resolve: { extensions: [".ts", ".js"] },
    plugins: [unpluginWebpack()],
    cache: {
      type: "filesystem",
      cacheDirectory: path.join(root, ".cache", "webpack"),
    },
    snapshot: {
      module: { hash: true, timestamp: false },
      resolve: { hash: true, timestamp: false },
      resolveBuildDependencies: { hash: true, timestamp: false },
      buildDependencies: { hash: true, timestamp: false },
    },
  };
}
