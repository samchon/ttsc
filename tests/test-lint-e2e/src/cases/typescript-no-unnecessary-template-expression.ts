declare const label: string;
declare const count: number;

// Positive: a single string-literal interpolation collapses to the
// literal value — `` `${"abc"}` `` is identical to `"abc"`.
// expect: typescript/no-unnecessary-template-expression error
const a = `${"abc"}`;

// Positive: a single string-typed interpolation with empty surrounding
// text — `${label}` coerces a known-string value for no reason.
// expect: typescript/no-unnecessary-template-expression error
const b = `${label}`;

// Positive: a no-substitution template literal with no escaped backticks
// is just a regular string literal written in backtick form.
// expect: typescript/no-unnecessary-template-expression error
const c = `plain text`;

// Negative: surrounding head text forces the template form.
const d = `prefix${label}`;

// Negative: the interpolated value is a number — coercion is meaningful.
const e = `${count}`;

// Negative: multiple spans cannot collapse to a single literal.
const f = `${label}-${count}`;

// Negative: tagged templates must preserve the raw payload for the tag.
const g = String.raw`${label}`;

JSON.stringify({ a, b, c, d, e, f, g });
