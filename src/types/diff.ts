// src/types/diff.ts

export interface DiffEntry {
  path: string;
  type: "ADDED" | "REMOVED" | "CHANGED";
  oldValue?: unknown;
  newValue?: unknown;
}