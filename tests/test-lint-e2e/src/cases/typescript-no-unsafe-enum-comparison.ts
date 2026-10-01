enum Color {
  Red = "red",
  Blue = "blue",
}
enum Status {
  Active = 1,
  Inactive = 2,
}
declare const color: Color;
declare const tag: Status;

// Positive: enum value compared with a raw string literal that shares
// the same widened primitive — accepts any unrelated string.
// expect: typescript/no-unsafe-enum-comparison error
const matchesRed = color === "red";

// Positive: enum value compared with a raw number literal.
// expect: typescript/no-unsafe-enum-comparison error
const isActive = tag !== 1;

// Negative: enum compared with one of its own members — the canonical
// safe shape.
const isBlue = color === Color.Blue;

JSON.stringify({ matchesRed, isActive, isBlue });
