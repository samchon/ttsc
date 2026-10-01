function shouldReport(): number {
  // expect: prefer-const error
  let value = 1;
  return value;
}

function sameNameButReassigned(): number {
  let value = 1;
  value += 1;
  return value;
}

let assignedLater: number;
// expect: prefer-const error
assignedLater = 1;

const input = { first: 1, second: 2 };
// expect: prefer-const error
let { first, second } = input;
first += 1;

console.log(
  shouldReport(),
  sameNameButReassigned(),
  assignedLater,
  first,
  second,
);
