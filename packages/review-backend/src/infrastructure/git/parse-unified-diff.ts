export type ParsedDiffFile = {
  path: string;
  hunks: Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: string[];
  }>;
};

export function parseUnifiedDiff(_input: string): ParsedDiffFile[] {
  return [];
}
