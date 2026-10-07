// expect: no-extend-native error
Array.prototype.foo = 1;
// expect: no-extend-native error
String.prototype.upper = function (): void {};
// expect: no-extend-native error
Array.prototype["baz"] = 2;
// expect: no-extend-native error
Object.defineProperty(Number.prototype, "half", { value: 3 });
// expect: no-extend-native error
Object.defineProperties(Boolean.prototype, { flip: { value: 4 } });
Object.foo = 1;
