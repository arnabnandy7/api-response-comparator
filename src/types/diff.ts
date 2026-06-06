// src/types/diff.ts

export interface DiffEntry {
  path: string;
  type: "ADDED" | "REMOVED" | "CHANGED" | "TYPE_CHANGE";
  devValue?: unknown;
  qaValue?: unknown;
  prodValue?: unknown;
}
