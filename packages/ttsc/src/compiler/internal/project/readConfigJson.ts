import fs from "node:fs";

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

/** Read and parse a strict-JSON configuration file, naming it on failure. */
export function readJsonFile(file: string): unknown {
  const text = stripLeadingBom(fs.readFileSync(file, "utf8"));
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`ttsc: failed to parse ${file}: ${describe(error)}`);
  }
}

/**
 * Read and parse a JSONC (JSON with comments and trailing commas) configuration
 * file — tsconfig.json, jsconfig.json — naming it on failure.
 */
export function readJsoncFile(file: string): unknown {
  const text = fs.readFileSync(file, "utf8");
  try {
    return parseJsonc(text);
  } catch (error) {
    throw new Error(`ttsc: failed to parse ${file}: ${describe(error)}`);
  }
}

/**
 * Parse a JSONC string by blanking comments and trailing commas before handing
 * off to `JSON.parse`. Exported for the readers' own unit coverage; callers
 * that hold a path should use {@link readJsoncFile} so failures are attributed.
 */
export function parseJsonc(input: string): unknown {
  return JSON.parse(stripTrailingCommas(stripComments(stripLeadingBom(input))));
}

/** Render a parse failure's message without the `Error:` noise around it. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Replace a leading UTF-8 BOM with a space. JSON ignores leading whitespace, so
 * blanking rather than removing keeps every later offset equal to the offset in
 * the original file. A BOM anywhere else is left in place and still rejected,
 * which is the behaviour issue #216 pinned.
 */
function stripLeadingBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? ` ${input.slice(1)}` : input;
}

/**
 * Blank `//` line comments and `/* block comments *\/` in a JSONC string,
 * writing a space for every removed character and preserving newlines.
 * Correctly handles strings that contain comment-like character sequences by
 * tracking string boundaries and escape characters.
 */
function stripComments(input: string): string {
  let output = "";
  let inBlockComment = false;
  let inLineComment = false;
  let inString = false;
  let quote = "";
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i]!;
    const next = input[i + 1];

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        output += "  ";
        i += 1;
        continue;
      }
      output += blank(current);
      continue;
    }
    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
        output += current;
        continue;
      }
      output += blank(current);
      continue;
    }
    if (inString) {
      output += current;
      if (escape) {
        escape = false;
      } else if (current === "\\") {
        escape = true;
      } else if (current === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      inLineComment = true;
      output += "  ";
      i += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      inBlockComment = true;
      output += "  ";
      i += 1;
      continue;
    }
    output += current;
  }
  return output;
}

/** Keep a newline as a newline; every other removed character becomes a space. */
function blank(current: string): string {
  return current === "\n" ? "\n" : " ";
}

/**
 * Blank trailing commas before `}` or `]` in a JSON string (after comments have
 * already been blanked). Handles string boundaries and escape characters to
 * avoid touching commas inside string values.
 */
function stripTrailingCommas(input: string): string {
  let output = "";
  let inString = false;
  let quote = "";
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i]!;
    if (inString) {
      output += current;
      if (escape) {
        escape = false;
      } else if (current === "\\") {
        escape = true;
      } else if (current === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }
    if (current === ",") {
      const next = nextNonWhitespace(input, i + 1);
      if (next === "}" || next === "]") {
        output += " ";
        continue;
      }
    }
    output += current;
  }
  return output;
}

/**
 * Return the first non-whitespace character at or after position `from` in
 * `input`, or `undefined` when only whitespace remains. Used by
 * `stripTrailingCommas` to detect whether a comma is trailing.
 */
function nextNonWhitespace(input: string, from: number): string | undefined {
  for (let i = from; i < input.length; i += 1) {
    const current = input[i]!;
    if (/\s/.test(current) === false) {
      return current;
    }
  }
  return undefined;
}
