const xs = [1, 2, 3];
// expect: unicorn/prefer-array-find error
const first = xs.filter((x) => x > 1)[0];
