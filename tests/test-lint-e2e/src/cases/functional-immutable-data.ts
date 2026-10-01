const obj = { value: 1 };

// expect: functional/immutable-data error
obj.value = 2;

JSON.stringify(obj);
