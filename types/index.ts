export interface SheetConfig {
  searchColumn: string;
  resultColumns: string[];
}

export interface SearchResult {
  [column: string]: string;
}
