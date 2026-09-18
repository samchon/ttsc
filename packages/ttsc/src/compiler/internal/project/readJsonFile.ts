import fs from "node:fs";
import { ConfigJsonText } from "./ConfigJsonText";

/**
 * Attributed JSON / JSONC readers for every configuration file ttsc owns.
 *
 * A bare `JSON.parse` failure reports a byte offset in an unnamed file, which
 * is unusable exactly where attribution matters most: an `extends` chain, where
 * any ancestor could be the source, and a watch session, which reprints the
 * same line on every save. Every ttsc-owned configuration read goes through
 * these helpers so the failure names its file and position in ttsc's own
 * diagnostic voice, like the neighbouring `ttsc: extended tsconfig not found:
 * …`.
 *
 * Comment, trailing-comma, and BOM removal is length-preserving (each removed
 * character becomes a space, each removed newline stays a newline), so the line
 * and column the JSON parser reports are the position in the file the user
 * actually edited rather than in a shortened intermediate string.
 */

/**
 * Read and parse a strict-JSON configuration file (`package.json`), naming it
 * on failure.
 *
 * A leading UTF-8 BOM is accepted, matching the tsconfig reader that closed
 * issue #216: the two readers are consulted for the same project and
 * disagreeing about a byte order mark would only surprise the user who hit it.
 */
export function readJsonFile(file: string): unknown {
  const text = ConfigJsonText.stripLeadingBom(fs.readFileSync(file, "utf8"));
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`ttsc: failed to parse ${file}: ${ConfigJsonText.describe(error)}`);
  }
}
