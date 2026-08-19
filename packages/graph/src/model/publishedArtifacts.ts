import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

/**
 * Ask the project's `@ttsc/lint` for the artifacts a citation can name, and
 * write them where `ttscgraph dump --artifacts` reads them.
 *
 * Returns the file's path, or `null` when the project has no lint install to
 * ask. A project without one is the common case and is not an error: the graph
 * it produces is the graph it produced before this existed, and the dump says
 * so by not claiming the capability.
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
 * exactly as `lsp-hints` does. This runs that verb.
 *
 * Nothing here knows what `@ttsc/evidence` is. It asks a lint install for
 * whatever its configured rules published, and a project that configured none
 * gets an empty answer.
 */
export function publishArtifacts(options: {
  cwd: string;
  tsconfig: string;
}): string | null {
  const binary = resolveLintBinary(options.cwd);
  if (binary === null) return null;

  const result = spawnSync(
    binary,
    ["graph-nodes", "--cwd", options.cwd, "--tsconfig", options.tsconfig],
    {
      // The set is one entry per document section, model field, and operation —
      // bounded by the project's own documentation, not by its source — so the
      // default pipe ceiling is raised rather than removed.
      maxBuffer: 256 * 1024 * 1024,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  // A lint install that cannot answer is not a broken graph. The verb is new,
  // so an older `@ttsc/lint` rejects the command outright, and a project whose
  // config does not parse has already failed somewhere the user can see. Either
  // way the graph is the one that existed before this, and the absent capability
  // claim is what says the producer got no answer.
  if (result.error || result.status !== 0 || typeof result.stdout !== "string")
    return null;

  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-graph-artifacts-")),
    "artifacts.json",
  );
  fs.writeFileSync(file, result.stdout);
  return file;
}

/**
 * The project's `@ttsc/lint` sidecar, resolved from the project rather than
 * from this package's own tree — the same rule `resolveGraphBinary` follows,
 * and for the same reason: a launcher started from an unrelated directory must
 * ask the install belonging to the project it was told to graph.
 */
function resolveLintBinary(cwd: string): string | null {
  const override = process.env.TTSC_LINT_BINARY;
  if (override !== undefined && path.isAbsolute(override)) return override;
  const exe = process.platform === "win32" ? "ttsclint.exe" : "ttsclint";
  try {
    const manifest = createRequire(
      require.resolve("@ttsc/lint/package.json", {
        paths: [path.resolve(cwd)],
      }),
    );
    const candidate = manifest.resolve(`@ttsc/lint/bin/${exe}`);
    return fs.existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
