// CI gate: every `FLAG_SCHEMA` kind must agree with the arity the compiler
// ttsc forwards to actually implements.
//
// A flag's `kind` decides how many argv tokens the launcher lets it occupy. A
// row that claims one token more than the receiving tool implements makes the
// forwarding path swallow the next token — that is how `ttsc --pretty a.ts`
// lost its input file and silently switched from single-file mode to project
// mode, and how `ttsx --pretty entry.ts` reported "entry file is required".
// Correcting the one row that surfaced would close the witness and leave the
// class open, so the comparison runs as a check instead.
//
// Oracle: `tsc --help --all` from the pinned `typescript` package, which prints
// each compiler option's `type:` line. `type: boolean` means the option occupies
// one token (and peeks a following `true`/`false` literal); every other type
// means it takes a value. Every schema row whose name the upstream table
// describes with a type is compared, whichever layer the row says consumes it —
// a shared name is itself the reason the arity has to agree. Options printed
// without a `type:` line (the `### Command-line Options` section) carry no
// arity information, so they are left uncompared rather than guessed at.
//
// Run through `pnpm run check:flags`.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import * as path from "node:path";

import { FLAG_SCHEMA } from "../src/flags/schema.ts";

type UpstreamOption = {
  /** Canonical upstream name including the leading dashes. */
  name: string;
  /** The `type:` line's value, or `undefined` when the help printed none. */
  type: string | undefined;
};

const table = readUpstreamOptionTable();
if (table === null) {
  process.exit(0);
}
process.exit(compareKinds(table) ? 0 : 1);

/**
 * Compare every schema row the upstream table describes with an explicit type.
 * Returns `true` when no row contradicts the compiler.
 */
function compareKinds(table: ReadonlyMap<string, UpstreamOption>): boolean {
  const contradictions: string[] = [];
  let compared = 0;
  for (const flag of FLAG_SCHEMA) {
    const upstream = table.get(normalize(flag.name));
    if (upstream?.type === undefined) continue;
    compared += 1;
    const upstreamBoolean = upstream.type === "boolean";
    const schemaBoolean = flag.kind === "boolean";
    if (upstreamBoolean === schemaBoolean) continue;
    contradictions.push(
      `  ${flag.name}: schema kind ${JSON.stringify(flag.kind)} contradicts upstream ` +
        `${JSON.stringify(upstream.type)} (${upstreamBoolean ? "expected boolean" : "expected a value-taking kind"})`,
    );
  }
  if (contradictions.length !== 0) {
    process.stderr.write(
      "ttsc flag schema: declared kinds contradict the upstream option table:\n",
    );
    process.stderr.write(`${contradictions.join("\n")}\n`);
    process.stderr.write(
      "a flag must occupy exactly the argv tokens its consuming tool implements;\n" +
        "fix the row in packages/ttsc/src/flags/schema.ts and re-run `pnpm run gen:flags`.\n",
    );
    return false;
  }
  process.stdout.write(
    `ttsc flag schema: ${compared} declared kinds agree with the upstream option table.\n`,
  );
  return true;
}

/** Match upstream names the way the compiler does: dash- and case-insensitive. */
function normalize(token: string): string {
  return token.replace(/^--?/, "").toLowerCase();
}

/**
 * Run the pinned `tsc --help --all` and index its option table by normalized
 * name. Returns `null` when the compiler cannot be resolved or produced no
 * usable table, so a checkout without a runnable platform binary reports the
 * gap instead of failing the build on a missing oracle.
 */
function readUpstreamOptionTable(): ReadonlyMap<string, UpstreamOption> | null {
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
  if (out.size < 50) {
    process.stderr.write(
      `ttsc flag schema: upstream option table unusable (parsed ${out.size} options); kind comparison skipped.\n`,
    );
    return null;
  }
  return out;
}

/** Read the `type: …` line belonging to an option block, if it printed one. */
function readTypeLine(
  lines: readonly string[],
  from: number,
): string | undefined {
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.startsWith("--") || line.startsWith("###")) return undefined;
    const match = line.match(/^type:\s*(.+)$/);
    if (match) return match[1]!.trim();
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
      `ttsc flag schema: pinned typescript CLI not resolvable (${describe(error)}); kind comparison skipped.\n`,
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
      }); kind comparison skipped.\n`,
    );
    return null;
  }
  return result.stdout;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
