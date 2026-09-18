import fs from "node:fs";
import { ConfigJsonText } from "./ConfigJsonText";

/**
 * Read and parse a JSONC (JSON with comments and trailing commas) configuration
 * file — tsconfig.json, jsconfig.json — naming it on failure.
 */
export function readJsoncFile(file: string): unknown {
  const text = fs.readFileSync(file, "utf8");
  try {
    return parseJsonc(text);
  } catch (error) {
    throw new Error(`ttsc: failed to parse ${file}: ${ConfigJsonText.describe(error)}`);
  }
}

/**
 * Parse a JSONC string by blanking comments and trailing commas before handing
 * off to `JSON.parse`. Callers hold a path, so they go through
 * {@link readJsoncFile} and their failures are attributed.
 */
function parseJsonc(input: string): unknown {
  return JSON.parse(stripTrailingCommas(stripComments(ConfigJsonText.stripLeadingBom(input))));
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
