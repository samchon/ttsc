// Positive: raw `<head>` element outside the `app/` directory.
// expect: nextjs/no-head-element error
const a = <head><title>Site</title></head>;

// Negative: no raw head element.
const b = null;

JSON.stringify({ a, b });
