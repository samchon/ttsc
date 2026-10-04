// @ts-ignore This ESNext-only input program does not enroll Node declaration libraries.
import { createRequire } from "node:module";
import { foo, bar, qux, grouped } from "./node-compatible/star/index.js";
import * as star from "./node-compatible/star/index.js";

/**
 * Observe real module edges in the single shared runtime, without child hosts.
 *
 * The CommonJS nodes belong to this NodeNext program. This does not assert the
 * former dependency-owned compiler profiles, separate CJS entry bootstraps,
 * cold caches, installed register entrypoints or CLI status behavior.
 */
export async function observeNodeCompatibleCorpus() {
  // @ts-ignore Native Node supplies ImportMeta.url without enrolled Node types.
  const require = createRequire(import.meta.url);
  const values: Record<string, unknown> = {};
  const failures: { name: string; message: string }[] = [];
  const capture = async (name: string, operation: () => unknown | Promise<unknown>): Promise<void> => {
    try { values[name] = await operation(); }
    catch (error) { failures.push({ name, message: error instanceof Error ? error.message : String(error) }); }
  };
  const ghosts = ["Hidden", "commentedGhost", "stringGhost", "commentAssignGhost", "blockAssignGhost", "stringAssignGhost", "templateAssignGhost"];
  await capture("nested-star-esm", () => ({
    joined: foo + ":" + bar() + ":" + qux + ":" + grouped.leaf,
    ghosts: ghosts.map((name) => name in star),
  }));
  await capture("nested-star-commonjs", () => {
    const lib = require("./node-compatible/star/index.js");
    return {
      joined: lib.foo + ":" + lib.bar() + ":" + lib.qux + ":" + lib.grouped.leaf,
      ghosts: ghosts.map((name) => name in lib),
    };
  });
  await capture("commonjs-circular-graph", () => {
    const cyclic = require("./node-compatible/cycle/index.js");
    return "combined:" + cyclic.combine();
  });
  await capture("dynamic-commonjs-tsx-rescue", async () => {
    const config = await import("./node-compatible/rescue/config.js");
    return config.default;
  });
  await capture("scanner-inert-text", async () => (await import("./node-compatible/scanner/main.js")).observed);
  await capture("query-and-hash", async () => (await import("./node-compatible/scanner/suffix.js")).observed);
  await capture("extensionless-side-effect", async () => (await import("./node-compatible/scanner/side-effect.js")).observed);
  await capture("extensionless-directory-index", async () => (await import("./node-compatible/scanner/directory.js")).observed);
  await capture("native-cjs-require-object", async () => {
    const libName = "./native-require/lib.cjs";
    const againName = "./native-require/again.cjs";
    const lib = await import(libName);
    const again = await import(againName);
    return { properties: lib.properties, value: again.value, whole: lib.default.value };
  });
  await capture("native-extension-detection", () => require("./native-require/detection/detector.cjs"));
  await capture("native-supported-require-hooks", async () => {
    const configName = "./native-require/hooks/config.js";
    const loaded = await import(configName);
    return { handler: loaded.handler, resolved: loaded.resolved, resolvedFromPaths: loaded.resolvedFromPaths, target: loaded.target, wrapped: loaded.wrapped };
  });
  return { values, failures };
}
