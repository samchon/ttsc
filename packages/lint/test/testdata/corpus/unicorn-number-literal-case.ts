// expect: unicorn/number-literal-case error
const n = 0xff;

// expect: unicorn/number-literal-case error
const prefix = 0XFF;

// expect: unicorn/number-literal-case error
const binary = 0B1010;

// expect: unicorn/number-literal-case error
const octal = 0O17;

// expect: unicorn/number-literal-case error
const exponent = 1E10;

// expect: unicorn/number-literal-case error
const signedExponent = 2E-5;

// expect: unicorn/number-literal-case error
const fraction = 0.5E3;

// expect: unicorn/number-literal-case error
const big = 0xffn;

const canonicalHex = 0xFF;
const canonicalExponent = 1e10;
const canonicalBig = 0xFF_FFn;
const canonicalDecimal = 1_000_000;
