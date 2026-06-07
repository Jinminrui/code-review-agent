export type ReviewUnit = {
  id: string;
  primaryFile: string;
  files: string[];
  diffPaths: string[];
  isNew?: boolean;
  isDeleted?: boolean;
  isBinary?: boolean;
};
