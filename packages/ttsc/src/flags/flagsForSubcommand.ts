import type { AnySubcommand } from "./AnySubcommand";
import type { FlagSpec } from "./FlagSpec";
import { FLAG_SCHEMA } from "./FLAG_SCHEMA";

/** Tokens (canonical name + aliases) accepted in `subcommand`. */
export function flagsForSubcommand(subcommand: AnySubcommand): FlagSpec[] {
  return FLAG_SCHEMA.filter((flag) => flag.subcommands.includes(subcommand));
}
