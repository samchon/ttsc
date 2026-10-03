// Positive: `className` listed twice on the same element.
// expect: react/jsx-no-duplicate-props error
const a = <div className="x" className="y" />;

// Negative: distinct prop names.
const b = <div className="x" id="y" />;

JSON.stringify({ a, b });
