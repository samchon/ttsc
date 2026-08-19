import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveCapabilityPlugins } from "ttsc";

/**
 * Ask the project's `@ttsc/lint` for the artifacts a citation can name, and
 * write them where `ttscgraph dump --artifacts` reads them.
 *
 * Returns the file's path, or `null` when no configured plugin declares the
 * capability or none answered. A project without one is the common case and is
 * not an error: the graph it produces is the graph it produced before this
 * existed, and the dump says so by not claiming the capability.
 *
 * ## Why this runs here and not in the compiler host
 *
 * The addresses a citation names — a Markdown anchor, `prisma:Sale.price`,
 * `POST:/orders` — are produced by parsers that live in the rule that owns
 * them, and re-deriving any of them in the graph producer would be a second
 * implementation of a published contract. So the units have to arrive from the
 * rule.
 *
 * They cannot arrive in-process. `ttscgraph` is the shipped per-platform
 * binary, never a per-project native host, so it can never have a linked
 * plugin; and `packages/lint` is its own Go module that deliberately carries no
 * requirement on the compiler host. What is left is the channel the host
 * already has: a plugin declares a capability and its sidecar answers a verb,
 * exactly as `lsp-hints` does. `resolveCapabilityPlugins` is what builds and
 * locates those sidecars, and it is the seam `ttscserver` already uses for
 * `capabilities.lsp`, published so a consumer outside the compiler can ask
 * too.
 *
 * Nothing here knows what `@ttsc/evidence` is. It asks a lint install for
 * whatever its configured rules published, and a project that configured none
 * gets an empty answer.
 */
export function publishArtifacts(options: {
  cwd: string;
  tsconfig: string;
}): string | null {
  const plugins = resolveCapabilityPlugins({
    capability: "graphNodes",
    cwd: options.cwd,
    tsconfig: options.tsconfig,
  });
  if (plugins.length === 0) return null;

  const published: unknown[] = [];
  for (const plugin of plugins) {
    const result = spawnSync(
      plugin.binary,
      [
        "graph-nodes",
        "--cwd",
        options.cwd,
        "--tsconfig",
        options.tsconfig,
        // The sidecar finds its own configured entry in this manifest. Without
        // it, it loads an empty rule configuration and answers as though the
        // project declared nothing — an empty answer indistinguishable from a
        // project that genuinely publishes none.
        `--plugins-json=${plugin.manifest}`,
      ],
      {
        // The set is one entry per document section, model field, and operation
        // — bounded by the project's own documentation, not by its source — so
        // the default pipe ceiling is raised rather than removed.
        maxBuffer: 256 * 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
      },
    );
    // A plugin that cannot answer is not a broken graph. The verb is new, so a
    // plugin built from an older source rejects the command outright, and a
    // project whose config does not parse has already failed somewhere the user
    // can see. Either way the graph is the one that existed before this, and the
    // absent capability claim is what says the producer got no answer.
    if (
      result.error ||
      result.status !== 0 ||
      typeof result.stdout !== "string"
    )
      continue;
    try {
      const parsed: unknown = JSON.parse(result.stdout);
      if (Array.isArray(parsed)) published.push(...parsed);
    } catch {
      continue;
    }
  }
  if (published.length === 0) return null;

  // One file per process, overwritten, rather than a fresh temp directory per
  // call. A resident session asks once and a one-shot asks once, but `loadGraph`
  // is a library entry a caller may run in a loop, and a directory per call is a
  // leak nothing here is positioned to clean: the path outlives this function by
  // design — the native producer reads it after we return.
  const file = path.join(
    os.tmpdir(),
    `ttsc-graph-artifacts-${String(process.pid)}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(published));
  return file;
}
