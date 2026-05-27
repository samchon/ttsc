const xs = [1, 2, 3];
// expect: unicorn/prefer-array-some error
const any = xs.filter((x) => x > 1).length > 0;
