declare const url: string;

// Positive: "click here" text.
const a = (
  // expect: jsx-a11y/anchor-ambiguous-text error
  <a href={url}>click here</a>
);

// Positive: "more" text.
const b = (
  // expect: jsx-a11y/anchor-ambiguous-text error
  <a href={url}>more</a>
);

// Negative: descriptive text.
const c = <a href={url}>Read the latest release notes</a>;

// Negative: no text — caught by anchor-has-content, not this rule.
const d = <a href={url} />;

JSON.stringify({ a, b, c, d });
