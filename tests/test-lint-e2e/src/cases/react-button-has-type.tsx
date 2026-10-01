// Positive: button with no type attribute.
// expect: react/button-has-type error
const a = <button>Submit</button>;

// Positive: button with an invalid type value.
// expect: react/button-has-type error
const b = <button type="bogus">Click</button>;

// Negative: explicit valid type.
const c = <button type="button">OK</button>;

// Negative: explicit submit type.
const d = <button type="submit">Save</button>;

JSON.stringify({ a, b, c, d });
