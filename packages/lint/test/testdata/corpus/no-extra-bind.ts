declare const receiver: { value: number };
const bindArguments = [receiver] as const;

// expect: no-extra-bind error
const arrow = (() => 1).bind(receiver);

// expect: no-extra-bind error
const regular = (function () {
  return 2;
}).bind(receiver);

// expect: no-extra-bind error
const computed = (function () {
  return 3;
})["bind"](receiver);

// expect: no-extra-bind error
const template = (function () {
  return 4;
})[`bind`](receiver);

// expect: no-extra-bind error
const optionalMember = (function () {
  return 5;
})?.["bind"](receiver);

// expect: no-extra-bind error
const optionalCall = (function () {
  return 6;
}).bind?.(receiver);

// expect: no-extra-bind error
const parenthesizedMember = ((function () {
  return 7;
}).bind)(receiver);

// expect: no-extra-bind error
const nestedRegular = (function () {
  return function (this: { value: number }) {
    return this.value;
  };
}).bind(receiver);

const partial = (function (value: number) {
  return value;
}).bind(null, 1);

const arrowPartial = ((value: number) => value).bind(null, 1);
const spread = (function () {
  return 8;
}).bind(...bindArguments);

const ownThis = (function (this: { value: number }) {
  return this.value;
}).bind(receiver);

const inheritedArrowThis = (function (this: { value: number }) {
  return () => this.value;
}).bind(receiver);

const parameterDefaultThis = (function (
  this: { value: number },
  value = this.value,
) {
  return value;
}).bind(receiver);

JSON.stringify({
  arrow,
  regular,
  computed,
  template,
  optionalMember,
  optionalCall,
  parenthesizedMember,
  nestedRegular,
  partial,
  arrowPartial,
  spread,
  ownThis,
  inheritedArrowThis,
  parameterDefaultThis,
});
