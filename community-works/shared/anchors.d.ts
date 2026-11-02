export interface ReadingAnchor {
  version: 1; kind: 'section' | 'paragraph' | 'selection'; revisionId: string; revisionHash: string;
  section: number; entry: number; block?: number; blockHash?: string; start?: number; end?: number; quote?: string
}
export function readingBlocks(text: string): string[]
export function anchorShape(value: unknown): value is ReadingAnchor
export function validateAnchor(anchor: ReadingAnchor, text: string, revisionId: string, revisionHash: string,
  hash: (text: string) => Promise<string> | string): Promise<boolean>
