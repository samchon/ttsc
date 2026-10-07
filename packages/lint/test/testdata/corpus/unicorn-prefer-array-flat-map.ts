// expect: unicorn/prefer-array-flat-map error
const result = [1, 2].map((x) => [x, x]).flat();
