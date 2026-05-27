// Positive: function declaration inside a `for` loop body.
function inForLoop(): void {
  for (let i = 0; i < 3; i++) {
    // expect: no-loop-func error
    function inner() {
      return i;
    }
    inner();
  }
}

// Positive: arrow function inside a `while` loop body.
function inWhileLoop(): void {
  let i = 0;
  while (i < 3) {
    // expect: no-loop-func error
    const inner = () => i;
    inner();
    i++;
  }
}

// Positive: function expression inside a `for ... of` loop body.
function inForOfLoop(items: number[]): void {
  for (const item of items) {
    // expect: no-loop-func error
    const make = function () {
      return item;
    };
    make();
  }
}

// Positive: arrow function inside a `for ... in` loop body.
function inForInLoop(obj: Record<string, number>): void {
  for (const key in obj) {
    // expect: no-loop-func error
    const grab = () => obj[key];
    grab();
  }
}

// Positive: arrow function inside a `do ... while` loop body.
function inDoWhileLoop(): void {
  let i = 0;
  do {
    // expect: no-loop-func error
    const inner = () => i;
    inner();
    i++;
  } while (i < 3);
}

// Negative: function declared OUTSIDE the loop — the closure captures
// the binding once, not per iteration.
function outsideLoop(): void {
  const make = (x: number) => () => x;
  for (let i = 0; i < 3; i++) {
    make(i)();
  }
}

JSON.stringify({
  inForLoop,
  inWhileLoop,
  inForOfLoop,
  inForInLoop,
  inDoWhileLoop,
  outsideLoop,
});
