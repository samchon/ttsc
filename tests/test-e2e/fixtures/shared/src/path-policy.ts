import { externalWork } from "path-dependency";

export class Store {
  public value = 0;
}

export const store = new Store();

export function seamStart(): void {
  if (store.value === 0) seamMiddleOne();
}

function seamMiddleOne(): void {
  seamMiddleTwo();
}

function seamMiddleTwo(): void {
  seamEnd();
}

export function seamEnd(): number {
  return store.value;
}

export function holderA(): number {
  return store.value;
}

export function holderB(): number {
  return store.value + 1;
}

export function apartLeft(): void {}
export function apartRight(): void {}

export function edgeStart(): void {
  edgeMid();
}

function edgeMid(): void {
  externalWork();
}

export function ringA(): void {
  ringB();
}

function ringB(): void {
  ringA();
}

export interface TypeBase {
  value: number;
}

export interface TypeMiddle extends TypeBase {
  extra: number;
}

export interface TypeLeaf extends TypeMiddle {
  more: number;
}

export interface Emitter {
  fire(): void;
}

export class Silent implements Emitter {
  public fire(): void {}
}

export function useEmitter(emitter: Emitter): void {
  emitter.fire();
}

