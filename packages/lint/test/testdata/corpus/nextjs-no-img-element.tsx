// Positive: raw `<img>` element instead of `next/image`.
// expect: nextjs/no-img-element error
const a = <img src="/hero.png" alt="hero" />;

// Negative: no raw img.
const b = null;

JSON.stringify({ a, b });
