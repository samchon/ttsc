// expect: no-extend-native error
Array.prototype.foo = 1;
// expect: no-extend-native error
String.prototype.upper = function (): void {};
Object.foo = 1;
