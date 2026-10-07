export type Wrapped =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g';
export type Flat = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
export enum LiteralColors { Red = 'red', Green = 'green', Blue = 'blue' }
export type Indirect = Wrapped | 'h';
export type Widened = Wrapped | string;
export function persistInherited(): void {}
export abstract class RootWorker {
  public abstract process(): void;
  public start(): void { this.process(); }
}
export abstract class IntermediateWorker extends RootWorker {}
export class ConcreteWorker extends IntermediateWorker {
  public process(): void { persistInherited(); }
}
export class InheritedRunner {
  public constructor(private readonly worker: RootWorker) {}
  public run(): void { this.worker.start(); }
}
export class Wide {
  m0(): void {}
  m1(): void {}
  m2(): void {}
  m3(): void {}
  m4(): void {}
  m5(): void {}
  m6(): void {}
  m7(): void {}
  m8(): void {}
  m9(): void {}
  m10(): void {}
  m11(): void {}
  m12(): void {}
  m13(): void {}
  m14(): void {}
  m15(): void {}
  m16(): void {}
  m17(): void {}
  m18(): void {}
  m19(): void {}
}
export type Values = 'v0' | 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8' | 'v9' | 'v10' | 'v11' | 'v12' | 'v13' | 'v14' | 'v15' | 'v16' | 'v17' | 'v18' | 'v19';
export function u0(w: Wide): void { void w; }
export function u1(w: Wide): void { void w; }
export function u2(w: Wide): void { void w; }
export function u3(w: Wide): void { void w; }
export function u4(w: Wide): void { void w; }
export function u5(w: Wide): void { void w; }
export function u6(w: Wide): void { void w; }
export function u7(w: Wide): void { void w; }
export function u8(w: Wide): void { void w; }
export function u9(w: Wide): void { void w; }
export function u10(w: Wide): void { void w; }
export function u11(w: Wide): void { void w; }
export function u12(w: Wide): void { void w; }
export function u13(w: Wide): void { void w; }
export function u14(w: Wide): void { void w; }
export function u15(w: Wide): void { void w; }
export function u16(w: Wide): void { void w; }
export function u17(w: Wide): void { void w; }
export function u18(w: Wide): void { void w; }
export function u19(w: Wide): void { void w; }

