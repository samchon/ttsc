// Positive: five levels of block nesting (if > for > while > if > if)
// exceed the default ceiling of four. The innermost `if` is the level
// that crosses the threshold so the diagnostic pins to it.
function deep(values: ReadonlyArray<number>): number {
  let total = 0;
  if (values.length > 0) {
    for (const value of values) {
      while (total < 100) {
        if (value > 0) {
          // expect: max-depth error
          if (value % 2 === 0) {
            total += value;
          }
        }
        total += 1;
      }
    }
  }
  return total;
}

// Negative: a flat function with no nested blocks stays well under the
// limit.
function shallow(value: number): number {
  return value + 1;
}

JSON.stringify({
  deep: deep([1, 2, 3]),
  shallow: shallow(0),
});
