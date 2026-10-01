export {};

const raw = "10";
const value: unknown = 0;

// Valid: parseInt without a radix already yields a base-10 integer.
void parseInt(raw);

// Valid: an explicit base-10 radix is equally redundant.
void parseInt(raw, 10);

// expect: unicorn/prefer-number-properties error
void parseInt(raw, 2);

// expect: unicorn/prefer-number-properties error
// expect: unicorn/prefer-number-properties error
const options = { normalize: parseFloat, parseInt };
void options;

// Valid: a locally shadowed isNaN is a different function.
{
  const isNaN = (input: unknown): boolean => input !== input;
  void isNaN(value);
}

// Valid: parseInt destructured from Number is a local binding.
{
  const { parseInt } = Number;
  void parseInt(raw, 2);
}

// Valid: -Infinity is left untouched unless checkInfinity is enabled.
const negative = -Infinity;
void negative;
