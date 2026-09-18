import { TYPESCRIPT_TRANSFORM_SOURCES } from "./TYPESCRIPT_TRANSFORM_SOURCES";

/** The exact automatic and documented Turbopack rule set. */
export const TYPESCRIPT_TURBOPACK_RULE_GLOBS: readonly string[] =
  TYPESCRIPT_TRANSFORM_SOURCES.map(({ extension }) => `*${extension}`);
