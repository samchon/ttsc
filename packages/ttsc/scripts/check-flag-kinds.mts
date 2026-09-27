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
// means it takes a value, as does an enumerated option, which prints `one of:`
// or `one or more:` instead of a type. Every schema row whose name the upstream table
// describes with a type is compared, whichever layer the row says consumes it —
// a shared name is itself the reason the arity has to agree. Options printed
// without a `type:` line (the `### Command-line Options` section) carry no
// arity information, so they are left uncompared rather than guessed at. The
// reader is shared with the generator of `COMPILER_OPTION_KINDS`
// (`readUpstreamOptionTable.mts`).
//
// Run through `pnpm run check:flags`.
import { FLAG_SCHEMA } from "../src/flags/FLAG_SCHEMA.ts";
import {
  type UpstreamOption,
  normalize,
  readUpstreamOptionTable,
} from "./readUpstreamOptionTable.mts";

const table = readUpstreamOptionTable();
if (table === null) {
  process.stderr.write("ttsc flag schema: kind comparison skipped.\n");
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
        "fix the row in packages/ttsc/src/flags/FLAG_SCHEMA.ts and re-run `pnpm run gen:flags`.\n",
    );
    return false;
  }
  process.stdout.write(
    `ttsc flag schema: ${compared} declared kinds agree with the upstream option table.\n`,
  );
  return true;
}

