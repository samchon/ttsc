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
// Oracle: exported OptionsDeclarations and OptionsForWatch of the pinned native
// module, read by the same shim-backed reader as the generated option metadata.
// This checks nominal boolean versus value kind for every matching schema name.
// Native scalar/list/config-only consumption is separately owned by the typed
// occurrence reader; a matching nominal kind does not certify token consumption.
//
// Run through `pnpm run check:flags`.
import { FLAG_SCHEMA } from "../src/flags/FLAG_SCHEMA.ts";
import { normalizeFlagToken } from "../src/flags/normalizeFlagToken.ts";
import type { CompilerOptionSpec } from "../src/flags/CompilerOptionSpec.ts";
import { readCompilerOptionTable } from "./readCompilerOptionTable.mts";

const table = readCompilerOptionTable().options;
process.exit(compareKinds(table) ? 0 : 1);

/**
 * Compare every schema row whose canonical name exists in native declarations.
 * Returns `true` when no row contradicts the compiler.
 */
function compareKinds(table: ReadonlyMap<string, CompilerOptionSpec>): boolean {
  const contradictions: string[] = [];
  let compared = 0;
  for (const flag of FLAG_SCHEMA) {
    const upstream = table.get(normalizeFlagToken(flag.name));
    if (upstream === undefined) continue;
    compared += 1;
    const upstreamBoolean = upstream.kind === "boolean";
    const schemaBoolean = flag.kind === "boolean";
    if (upstreamBoolean === schemaBoolean) continue;
    contradictions.push(
      `  ${flag.name}: schema kind ${JSON.stringify(flag.kind)} contradicts upstream ` +
        `${JSON.stringify(upstream.kind)} (${upstreamBoolean ? "expected boolean" : "expected a value-taking kind"})`,
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
