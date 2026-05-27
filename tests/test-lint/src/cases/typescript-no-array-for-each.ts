// Positive: arr.forEach(...) call.
// expect: typescript/no-array-for-each error
[1, 2, 3].forEach((value) => {
  JSON.stringify(value);
});

// Positive: forEach on a named variable.
const items = [1, 2, 3];
// expect: typescript/no-array-for-each error
items.forEach((value) => {
  JSON.stringify(value);
});

// Negative: for-of replacement.
for (const value of items) {
  JSON.stringify(value);
}

JSON.stringify(items);
