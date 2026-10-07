// Negative: ignored literals (0, 1, -1) never fire.
const zero = 0;
const one = 1;
const minusOne = -1;

// Negative: `const x = N` is the named binding the rule wants.
const SECONDS_PER_MINUTE = 60;

// Negative: enum member values are intentional named numbers.
enum Status {
  Pending = 0,
  Done = 1,
}

// Negative: numeric subscript on element access is `ignoreArrayIndexes`.
const items = [zero, one];
const first = items[0];

// Positive: a bare literal in an arithmetic expression carries no meaning.
// expect: no-magic-numbers error
const total = SECONDS_PER_MINUTE * 60;

// Positive: `let` cannot anchor a named constant — the value stays magic.
// expect: no-magic-numbers error
let timeout = 5000;

void minusOne;
void Status;
void first;
void total;
void timeout;
