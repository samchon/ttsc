declare const xs: number[];
// expect: unicorn/no-useless-length-check error
const any = xs.length > 0 && xs.some((x) => x > 0);
void any;
