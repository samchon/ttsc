declare function require(name: string): unknown;
// expect: unicorn/prefer-module error
require("path");
