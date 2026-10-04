export interface ICited {
  note: string;
}

export interface IUsed {
  value: number;
}

export function helper(): void {}

/**
 * Renders the notice.
 *
 * @evidence {@link ICited} The contract this mirrors.
 */
export function DocLinkedNotice(input: IUsed): void {
  helper();
}

