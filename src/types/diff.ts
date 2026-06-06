// src/types/diff.ts

export interface DiffEntry {
  path: string;
  type: "ADDED" | "REMOVED" | "CHANGED" | "TYPE_CHANGE";
  oldValue?: unknown;
  newValue?: unknown;
}
