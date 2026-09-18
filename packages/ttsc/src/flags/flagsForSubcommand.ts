import type { AnySubcommand } from "./AnySubcommand";
import { FLAG_SCHEMA } from "./FLAG_SCHEMA";
import type { FlagSpec } from "./FlagSpec";

/** Tokens (canonical name + aliases) accepted in `subcommand`. */
export function flagsForSubcommand(subcommand: AnySubcommand): FlagSpec[] {
  return FLAG_SCHEMA.filter((flag) => flag.subcommands.includes(subcommand));
}
