function isEven(n: number) { return n % 2 === 0; }
// expect: unicorn/no-array-callback-reference error
const evens = [1, 2, 3].filter(isEven);
