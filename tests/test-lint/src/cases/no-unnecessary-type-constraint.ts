// expect: noUnnecessaryTypeConstraint error
function identity<T extends unknown>(value: T): T {
  return value;
}
