declare const text: string;
declare function sideEffect(value: unknown): void;

// Positive: `str.match(/foo/)` — regex has no `g` flag, so `match` and
// `exec` return the same first-match shape; `exec` is the more direct
// API and is stable when the regex later gains the `g` flag.
// expect: typescript/prefer-regexp-exec error
const m1 = text.match(/foo/);

// Positive: case-insensitive flag without `g` is still the first-match
// shape — still rewritable.
// expect: typescript/prefer-regexp-exec error
const m2 = text.match(/foo/i);

// Negative: `/g` regex — `String#match` returns every match here while
// `RegExp#exec` would only return the first, so the rule must NOT fire.
const ok1 = text.match(/foo/g);

// Negative: `/gi` — combined flag still contains `g`.
const ok2 = text.match(/foo/gi);

// Negative: already using `exec` — already the form the rule asks for.
const ok3 = /foo/.exec(text);

// Negative: `match` on a non-regex argument (a plain string is coerced
// to RegExp at runtime, but the rule needs the regex literal shape to
// see the flags). The AST-only baseline conservatively skips this.
const ok4 = text.match("foo");

sideEffect({ m1, m2, ok1, ok2, ok3, ok4 });
