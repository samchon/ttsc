const items = [1, 2, 3];

// expect: functional/no-loop-statements error
for (const item of items) {
  JSON.stringify(item);
}
