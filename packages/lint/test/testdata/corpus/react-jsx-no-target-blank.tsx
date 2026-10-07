declare const url: string;

// Positive: target="_blank" with no rel attribute.
const a = (
  // expect: react/jsx-no-target-blank error
  <a href={url} target="_blank">
    open
  </a>
);

// Positive: target="_blank" with rel that lacks noreferrer.
const b = (
  // expect: react/jsx-no-target-blank error
  <a href={url} target="_blank" rel="noopener">
    open
  </a>
);

// Positive: self-closing form on a non-anchor element.
// expect: react/jsx-no-target-blank error
const c = <area href={url} target="_blank" />;

// Negative: rel includes noreferrer.
const d = (
  <a href={url} target="_blank" rel="noreferrer">
    open
  </a>
);

// Negative: rel includes both noopener and noreferrer.
const e = (
  <a href={url} target="_blank" rel="noopener noreferrer">
    open
  </a>
);

// Negative: target is not _blank.
const f = (
  <a href={url} target="_self">
    open
  </a>
);

// Negative: no target attribute at all.
const g = <a href={url}>open</a>;

JSON.stringify({ a, b, c, d, e, f, g });
