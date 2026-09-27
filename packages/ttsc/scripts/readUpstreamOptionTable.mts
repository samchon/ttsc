// The pinned compiler's own option table, shared by the flag generator and the
// kind check. The oracle is `tsc --help --all` from the pinned `typescript`
// package, which prints each compiler option's `type:` line.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import * as path from "node:path";

/** One option of the pinned compiler's help. */
export type UpstreamOption = {
  /** Canonical upstream name including the leading dashes. */
  name: string;
  /** The `type:` line's value, or `undefined` when the help printed none. */
  type: string | undefined;
};

/** Match upstream names the way the compiler does: dash- and case-insensitive. */
export function normalize(token: string): string {
  return token.replace(/^--?/, "").toLowerCase();
}

/**
 * Run the pinned `tsc --help --all` and index its option table by normalized
 * name. Returns `null` when the compiler cannot be resolved or produced no
 * usable table, so a checkout without a runnable platform binary reports the
 * gap instead of failing the build on a missing oracle.
 */
export function readUpstreamOptionTable(): ReadonlyMap<string, UpstreamOption> | null {
  const help = runTscHelp();
  if (help === null) return null;
  const out = new Map<string, UpstreamOption>();
  const lines = help.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!line.startsWith("--")) continue;
    // `--project, -p` declares one option under two spellings; both index to
    // the same entry so a schema row keyed on either resolves.
    const names = line.split(",").map((part) => part.trim());
    if (!names.every((name) => /^-{1,2}[^\s]+$/.test(name))) continue;
    const type = readTypeLine(lines, i + 1);
    for (const name of names) {
      const key = normalize(name);
      // The help prints `--help, -h` and `--help, -?` as separate entries; keep
      // the first, which is the one carrying the description.
      if (!out.has(key)) out.set(key, { name: names[0]!, type });
    }
  }
  // A help that parsed into no option at all is not a table. A partial one is
  // still what the compiler printed: the kind check reports every schema row it
  // lacks, and the generated table's diff shows what moved.
  if (out.size === 0) {
    process.stderr.write(
      `ttsc flag schema: upstream option table unusable (parsed ${out.size} options).\n`,
    );
    return null;
  }
  return out;
}

/**
 * Read the type an option block prints: its `type:` line, `one of` or `one or
 * more` for an enumerated option, or `undefined` when it printed neither.
 */
function readTypeLine(
  lines: readonly string[],
  from: number,
): string | undefined {
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.startsWith("--") || line.startsWith("###")) return undefined;
    const match = line.match(/^type:\s*(.+)$/);
    if (match) return match[1]!.trim();
    // An enumerated option lists its values instead of a type, and takes one
    // (`one of:`) or a comma-separated list of them (`one or more:`).
    const choice = line.match(/^(one of|one or more):/);
    if (choice) return choice[1]!;
  }
  return undefined;
}

/** Spawn the pinned compiler's full help, or `null` when it cannot be run. */
function runTscHelp(): string | null {
  const require = createRequire(import.meta.url);
  let cli: string;
  try {
    // `typescript`'s `exports` map does not expose `./bin/tsc`, so the CLI is
    // located through the manifest's own `bin` entry rather than by subpath.
    const manifest = require.resolve("typescript/package.json");
    const bin = (require(manifest) as { bin?: { tsc?: string } }).bin?.tsc;
    if (bin === undefined) throw new Error("typescript declares no `bin.tsc`");
    cli = path.resolve(path.dirname(manifest), bin);
  } catch (error) {
    process.stderr.write(
      `ttsc flag schema: pinned typescript CLI not resolvable (${describe(error)}).\n`,
    );
    return null;
  }
  const result = spawnSync(process.execPath, [cli, "--help", "--all"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    process.stderr.write(
      `ttsc flag schema: pinned typescript CLI could not print its option table (${
        result.error ? describe(result.error) : `exit ${result.status}`
      }).\n`,
    );
    return null;
  }
  return result.stdout;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
