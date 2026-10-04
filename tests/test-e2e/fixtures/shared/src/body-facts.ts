export function bodyAccepted(): void {}
export function derivedOnly(): void {}

export interface BodyPipeline {
  execute(): void;
}

export class Empty implements BodyPipeline {
  public execute(): void {}
}

export function callBodyPipeline(pipeline: BodyPipeline): void {
  pipeline.execute();
}

export interface Reader {
  read(): number;
}

export class Constant implements Reader {
  public read(): number {
    return 1;
  }
}

export class Computed implements Reader {
  public read(): number {
    let total = 0;
    for (let i = 0; i < 3; i++) total += i;
    return total;
  }
}

export class Refusing implements Reader {
  public read(): number {
    throw "unsupported";
  }
}

export function callReader(reader: Reader): number {
  return reader.read();
}

export abstract class Task {
  public abstract perform(): void;

  public start(): void {
    this.perform();
  }
}

export class QuietTask extends Task {
  public perform(): void {}
}

export interface Shape {
  area(): number;
}

export abstract class BaseShape implements Shape {
  public abstract area(): number;
}

export class Square extends BaseShape {
  public area(): number {
    return 4;
  }
}

export function callShape(shape: Shape): number {
  return shape.area();
}

export abstract class Twice {
  public abstract emit(): void;
}

export class OnlyOnce extends Twice implements Twice {
  public emit(): void {}
}

export function callTwice(twice: Twice): void {
  twice.emit();
}

declare class Native {
  handle(): void;
}

export class RealNative extends Native {
  public handle(): void {}
}

export function callNative(native: Native): void {
  native.handle();
}

export class Base {
  public run(): void {}
}

export class Derived extends Base {
  public run(): void {
    derivedOnly();
  }
}

export function callBase(base: Base): void {
  base.run();
}

export class Loud {
  public speak(): void {
    bodyAccepted();
  }
}

export class Louder extends Loud {
  public speak(): void {
    derivedOnly();
  }
}

export function callLoud(loud: Loud): void {
  loud.speak();
}

export class Formatter {
  public format(value: string): string;
  public format(value: number): string;
  public format(value: string | number): string {
    return String(value);
  }
}

export function callFormatter(formatter: Formatter): string {
  return formatter.format(1);
}

