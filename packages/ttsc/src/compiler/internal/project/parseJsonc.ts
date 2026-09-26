/**
 * Parse the text of a JSONC configuration file, a `tsconfig.json` or a
 * `jsconfig.json`, by the grammar TypeScript-Go reads one with.
 *
 * The compiler parses a config with its own scanner and accepts every literal
 * form its JSON conversion takes without a diagnostic: comments that end at any
 * ECMAScript line terminator (`\n`, `\r`, U+2028, U+2029), every character it
 * counts as whitespace (a byte-order mark, a no-break space, the Unicode space
 * separators), trailing commas, hexadecimal, octal, binary, fractional and
 * separated numbers, the full string escape set, and a file holding no value at
 * all, which reads as an empty object. It rejects what its conversion reports:
 * a key or string that is not double-quoted (TS1327), a value that is not a
 * literal (TS1328), a legacy octal number (TS1121), a missing comma, and text
 * after the root value. Layering comment stripping over `JSON.parse` left a
 * narrower grammar that refused CR-only line comments and every form above.
 *
 * The one reading of that grammar in the workspace. ttsc's own project reader
 * reads every config through it (`readJsoncFile`), and `@ttsc/unplugin` reads
 * the configs it builds its membership policy and alias overlay from through
 * the `ttsc/tsconfig` entry, so the two cannot disagree about what a config
 * says (samchon/ttsc#1489). A failure names the line and column of the original
 * text, counting lines the way the compiler does.
 *
 * @param input The file's text as read.
 * @returns The parsed value.
 * @throws A `SyntaxError` naming the position of text that is not a config.
 */
export function parseJsonc(input: string): unknown {
  const reader = new JsoncReader(input);
  reader.skipTrivia();
  if (reader.done()) return {};
  const value = reader.readValue();
  reader.skipTrivia();
  if (!reader.done()) reader.fail("Unexpected text after the root value");
  return value;
}

/** A cursor over config text that reads one value at a time. */
class JsoncReader {
  private pos = 0;

  public constructor(private readonly text: string) {}

  public done(): boolean {
    return this.pos >= this.text.length;
  }

  /** Skip whitespace, line terminators, and comments. */
  public skipTrivia(): void {
    while (!this.done()) {
      const current = this.text.charCodeAt(this.pos);
      if (isWhiteSpace(current) || isLineBreak(current)) {
        this.pos += 1;
      } else if (this.text.startsWith("//", this.pos)) {
        this.pos += 2;
        while (!this.done() && !isLineBreak(this.text.charCodeAt(this.pos)))
          this.pos += 1;
      } else if (this.text.startsWith("/*", this.pos)) {
        const end = this.text.indexOf("*/", this.pos + 2);
        if (end === -1) this.fail("Unterminated comment");
        this.pos = end + 2;
      } else {
        return;
      }
    }
  }

  public readValue(): unknown {
    const current = this.text[this.pos];
    if (current === "{") return this.readObject();
    if (current === "[") return this.readArray();
    if (current === '"') return this.readString();
    if (current === "'")
      this.fail("String literal with double quotes expected");
    if (current === "-") {
      // A prefix minus, which the compiler parses with trivia after it.
      this.pos += 1;
      this.skipTrivia();
      return -this.readNumber();
    }
    if (current !== undefined && isNumberStart(this.text, this.pos))
      return this.readNumber();
    const word = /^[A-Za-z_$][\w$]*/.exec(this.text.slice(this.pos))?.[0];
    if (word === "true" || word === "false" || word === "null") {
      this.pos += word.length;
      return word === "true" ? true : word === "false" ? false : null;
    }
    return this.fail(
      this.done()
        ? "Unexpected end of text"
        : "Property value can only be string literal, numeric literal, 'true', 'false', 'null', object literal or array literal",
    );
  }

  /** Raise a failure positioned at the cursor. */
  public fail(message: string): never {
    let line = 1;
    let column = 1;
    for (let i = 0; i < this.pos && i < this.text.length; i += 1) {
      const current = this.text.charCodeAt(i);
      if (current === 0x0d && this.text.charCodeAt(i + 1) === 0x0a) continue;
      if (isLineBreak(current)) {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    throw new SyntaxError(`${message} (line ${line} column ${column})`);
  }

  private readObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    this.pos += 1;
    this.readElements("}", () => {
      if (this.text[this.pos] !== '"')
        this.fail("String literal with double quotes expected");
      const key = this.readString();
      this.skipTrivia();
      if (this.text[this.pos] !== ":") this.fail("':' expected");
      this.pos += 1;
      this.skipTrivia();
      // A defined property, so a `__proto__` key stays an ordinary key.
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: this.readValue(),
        writable: true,
      });
    });
    return result;
  }

  private readArray(): unknown[] {
    const result: unknown[] = [];
    this.pos += 1;
    this.readElements("]", () => result.push(this.readValue()));
    return result;
  }

  /** Read comma-separated elements up to `close`, allowing a trailing comma. */
  private readElements(close: string, readElement: () => void): void {
    this.skipTrivia();
    while (this.text[this.pos] !== close) {
      if (this.done()) this.fail(`'${close}' expected`);
      readElement();
      this.skipTrivia();
      if (this.text[this.pos] === ",") {
        this.pos += 1;
        this.skipTrivia();
      } else if (this.text[this.pos] !== close) {
        this.fail("',' expected");
      }
    }
    this.pos += 1;
  }

  private readString(): string {
    let out = "";
    this.pos += 1;
    for (;;) {
      if (this.done() || isLineBreak(this.text.charCodeAt(this.pos)))
        this.fail("Unterminated string literal");
      const current = this.text[this.pos]!;
      if (current === '"') {
        this.pos += 1;
        return out;
      }
      if (current !== "\\") {
        out += current;
        this.pos += 1;
        continue;
      }
      out += this.readEscape();
    }
  }

  /** Read one escape sequence, starting at its backslash. */
  private readEscape(): string {
    this.pos += 1;
    if (this.done()) this.fail("Unexpected end of text");
    const current = this.text[this.pos]!;
    this.pos += 1;
    const simple = SIMPLE_ESCAPES[current];
    if (simple !== undefined) return simple;
    if (current === "0" && !/[0-9]/.test(this.text[this.pos] ?? ""))
      return "\0";
    if (/[0-7]/.test(current)) {
      // A legacy octal escape: up to three digits, below 0o400.
      let digits = current;
      while (
        digits.length < (current <= "3" ? 3 : 2) &&
        /[0-7]/.test(this.text[this.pos] ?? "")
      ) {
        digits += this.text[this.pos];
        this.pos += 1;
      }
      return String.fromCharCode(parseInt(digits, 8));
    }
    if (current === "x") return this.readHexEscape(2);
    if (current === "u") {
      if (this.text[this.pos] !== "{") return this.readHexEscape(4);
      const hex = /^\{([0-9A-Fa-f]+)\}/.exec(this.text.slice(this.pos));
      if (hex === null || parseInt(hex[1]!, 16) > 0x10ffff) return "\\u";
      this.pos += hex[0].length;
      return String.fromCodePoint(parseInt(hex[1]!, 16));
    }
    if (current === "\r") {
      if (this.text[this.pos] === "\n") this.pos += 1;
      return "";
    }
    if (isLineBreak(current.charCodeAt(0))) return "";
    return current;
  }

  /**
   * Read the digits of a `\x` or `\u` escape. An escape without its full digit
   * count stays in the string as written, as the compiler keeps it.
   */
  private readHexEscape(length: number): string {
    const start = this.pos - 2;
    while (
      this.pos - start - 2 < length &&
      /[0-9A-Fa-f]/.test(this.text[this.pos] ?? "")
    )
      this.pos += 1;
    const hex = this.text.slice(start + 2, this.pos);
    return hex.length === length
      ? String.fromCharCode(parseInt(hex, 16))
      : this.text.slice(start, this.pos);
  }

  private readNumber(): number {
    const rest = this.text.slice(this.pos);
    const token = NUMERIC_LITERAL.exec(rest)?.[0];
    if (token === undefined) return this.fail("Numeric literal expected");
    if (/^0[0-9]/.test(token)) this.fail("Octal literals are not allowed");
    this.pos += token.length;
    // A separator in the wrong place, a second `.`, or a suffix stops the
    // literal early; the compiler reports what follows it.
    if (/^[\w$.]/.test(this.text[this.pos] ?? ""))
      this.fail("Invalid character after a numeric literal");
    return Number(token.replaceAll("_", ""));
  }
}

/**
 * An ECMAScript numeric literal without a sign: hexadecimal, octal, binary, or
 * decimal with an optional fraction and exponent, each digit run allowing
 * single `_` separators between digits.
 */
const NUMERIC_LITERAL = new RegExp(
  [
    "^0[xX][0-9A-Fa-f]+(?:_[0-9A-Fa-f]+)*",
    "^0[oO][0-7]+(?:_[0-7]+)*",
    "^0[bB][01]+(?:_[01]+)*",
    "^(?:[0-9]+(?:_[0-9]+)*(?:\\.(?:[0-9]+(?:_[0-9]+)*)?)?|\\.[0-9]+(?:_[0-9]+)*)(?:[eE][+-]?[0-9]+(?:_[0-9]+)*)?",
  ].join("|"),
);

const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  "'": "'",
  "\\": "\\",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

/** Whether a number starts at `pos`: a digit, or a `.` before a digit. */
function isNumberStart(text: string, pos: number): boolean {
  return /[0-9]/.test(text[pos]!) || /^\.[0-9]/.test(text.slice(pos, pos + 2));
}

/** TypeScript-Go's `IsLineBreak`: the ECMAScript line terminators. */
function isLineBreak(code: number): boolean {
  return code === 0x0a || code === 0x0d || code === 0x2028 || code === 0x2029;
}

/** TypeScript-Go's `IsWhiteSpaceSingleLine`. */
function isWhiteSpace(code: number): boolean {
  return (
    code === 0x20 ||
    code === 0x09 ||
    code === 0x0b ||
    code === 0x0c ||
    code === 0x85 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200b) ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}
