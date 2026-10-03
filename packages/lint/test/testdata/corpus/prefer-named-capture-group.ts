// Positive: a bare `(\d+)` is an unnamed capture group.
// expect: prefer-named-capture-group error
const yearOnly = /(\d{4})/;

// Positive: alternation inside a capturing group still flags — the
// outer group lacks a name.
// expect: prefer-named-capture-group error
const protocol = /(http|https):\/\//;

// Negative: a non-capturing group `(?:…)` doesn't capture, so the rule
// has no name to ask for.
const versionGroup = /(?:v?)\d+/;

// Negative: a named capture group is already the recommended form.
const namedYear = /(?<year>\d{4})/;

// Negative: a lookahead assertion `(?=…)` doesn't capture.
const lookahead = /foo(?=bar)/;

// Negative: a character class containing `(` is a literal `(` byte,
// not a group opener.
const literalParen = /[()]/;

JSON.stringify({ yearOnly, protocol, versionGroup, namedYear, lookahead, literalParen });
