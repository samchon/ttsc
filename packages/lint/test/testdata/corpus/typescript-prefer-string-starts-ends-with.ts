declare const text: string;
declare const needle: string;
declare const arr: string[];
declare function sideEffect(value: unknown): void;

// Positive: `str.indexOf(p) === 0` — the canonical startsWith shape.
// expect: typescript/prefer-string-starts-ends-with error
const a = text.indexOf(needle) === 0;

// Positive: `str.indexOf(p, str.length - p.length) !== -1` — endsWith via
// the positional indexOf form.
// expect: typescript/prefer-string-starts-ends-with error
const b = text.indexOf(needle, text.length - needle.length) !== -1;

// Positive: `str.lastIndexOf(p) === str.length - p.length` — the
// canonical endsWith shape.
// expect: typescript/prefer-string-starts-ends-with error
const c = text.lastIndexOf(needle) === text.length - needle.length;

// Positive: anchored-prefix regex tested against a string.
// expect: typescript/prefer-string-starts-ends-with error
const d = /^foo/.test(text);

// Positive: anchored-suffix regex tested against a string.
// expect: typescript/prefer-string-starts-ends-with error
const e = /bar$/.test(text);

// Negative: already using the dedicated method.
const ok1 = text.startsWith(needle);

// Negative: receiver of indexOf is not a string.
const ok2 = arr.indexOf("a") === 0;

// Negative: regex with metacharacters (the rewrite would change matching).
const ok3 = /^foo.*/.test(text);

// Negative: case-insensitive flag — `startsWith` does not lower-case.
const ok4 = /^foo/i.test(text);

sideEffect({ a, b, c, d, e, ok1, ok2, ok3, ok4 });
