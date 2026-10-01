// @ttsc-corpus-clean: unicorn/no-array-callback-reference
function isEven(n: number) { return n % 2 === 0; } const evens = [1,2,3].filter(x => isEven(x));
