// expect: prefer-numeric-literals error
const hex = parseInt("ff", 16);
JSON.stringify(hex);
