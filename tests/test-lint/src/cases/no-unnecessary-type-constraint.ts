// expect: no-unnecessary-type-constraint error
function identity<T extends unknown>(value: T): T {
  return value;
}
