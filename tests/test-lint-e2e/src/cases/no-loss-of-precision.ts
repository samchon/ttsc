// expect: no-loss-of-precision error
const big = 9007199254740993;
// expect: no-loss-of-precision error
const fractional = 1.0000000000000001;
// expect: no-loss-of-precision error
const exponent = 9.007199254740993e15;
// expect: no-loss-of-precision error
const binary = 0b100000000000000000000000000000000000000000000000000001;
// expect: no-loss-of-precision error
const octal = 0o400000000000000001;
// expect: no-loss-of-precision error
const hexadecimal = 0x20000000000001;
// expect: no-loss-of-precision error
const overflow = 1e999;
// expect: no-loss-of-precision error
const underflow = 1e-324;

const exactBoundary = 9007199254740992;
const exactFraction = 1.0000000000000002;
const exactSubnormal = 5e-324;
const exactHexadecimal = 0x20000000000000;
const bigint = 9007199254740993n;

void [
  big,
  fractional,
  exponent,
  binary,
  octal,
  hexadecimal,
  overflow,
  underflow,
  exactBoundary,
  exactFraction,
  exactSubnormal,
  exactHexadecimal,
  bigint,
];
