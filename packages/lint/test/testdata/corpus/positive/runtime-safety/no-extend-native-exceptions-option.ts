// @ttsc-corpus-options: no-extend-native {"exceptions":["String"]}
// expect: no-extend-native error
Array.prototype.foo = 1;
String.prototype.bar = 1;
