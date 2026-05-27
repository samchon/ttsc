declare const xs: number[];
// expect: unicorn/no-useless-length-check error
const all = xs.length > 0 && xs.every((x) => x > 0);
void all;
