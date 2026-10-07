// Positive: `new Symbol("x")` — Symbol is not a constructor.
// expect: no-new-symbol error
const bad = new Symbol("desc");

// Negative: Symbol called as a function (the correct usage).
const good = Symbol("desc");

JSON.stringify({ bad, good });
