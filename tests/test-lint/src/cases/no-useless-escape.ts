// expect: noUselessEscape error
const value = "ab\cdef";
JSON.stringify(value);
