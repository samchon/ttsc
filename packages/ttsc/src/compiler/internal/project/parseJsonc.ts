import { ConfigJsonText } from "./ConfigJsonText";

/**
 * Parse the text of a JSONC configuration file, a `tsconfig.json` or a
 * `jsconfig.json`, as TypeScript reads one: a leading byte-order mark is
 * dropped, `//` and block comments are blanked, and a comma before `}` or `]`
 * is blanked, before `JSON.parse` reads what remains.
 *
 * The one reading of that grammar in the workspace. ttsc's own project reader
 * reads every config through it (`readJsoncFile`), and `@ttsc/unplugin` reads
 * the configs it builds its membership policy and alias overlay from through
 * the `ttsc/tsconfig` entry, so the two cannot disagree about what a config
 * says (samchon/ttsc#1489). Blanking writes a space for every removed character
 * and keeps every newline, so a `JSON.parse` error still points at the line and
 * column of the original text.
 *
 * @param input The file's text as read.
 * @returns The parsed value.
 * @throws What `JSON.parse` throws for text that is not JSONC.
 */
export function parseJsonc(input: string): unknown {
  return JSON.parse(
    stripTrailingCommas(stripComments(ConfigJsonText.stripLeadingBom(input))),
  );
}

/**
 * Blank `//` line comments and block comments in a JSONC string, writing a
 * space for every removed character and preserving newlines. Tracks string
 * boundaries and escapes, so comment-like text inside a string survives.
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
 * Blank trailing commas before `}` or `]` in a JSON string whose comments are
 * already blanked. Tracks string boundaries and escapes, so a comma inside a
 * string value survives.
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
 * The first non-whitespace character at or after `from`, or `undefined` when
 * only whitespace remains.
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
