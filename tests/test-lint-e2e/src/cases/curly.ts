// Positive: single-statement `if` body should be wrapped in a block.
const flag: boolean = Math.random() > 0.5;
// expect: curly error
if (flag) console.log("if");

// Positive: bare `else` branch is flagged the same way.
if (flag) {
  console.log("then");
  // expect: curly error
} else console.log("else");

// Positive: `while`, `do`, and `for` family loops also require braces.
let i: number = 0;
// expect: curly error
while (i < 1) i += 1;

let j: number = 0;
// expect: curly error
do j += 1;
while (j < 1);

// expect: curly error
for (let k: number = 0; k < 1; k += 1) console.log(k);

const arr: number[] = [1, 2];
// expect: curly error
for (const value of arr) console.log(value);

// Negative: `else if` chains stay legal — the rule walks into the next
// IfStatement and reports its body, not the chain itself.
if (flag) {
  console.log("a");
} else if (!flag) {
  console.log("b");
} else {
  console.log("c");
}
