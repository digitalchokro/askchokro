/**
 * @digitalchokro/core — Schema Types
 */

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
  /** Optional human annotation set via agent.annotate(). */
  annotation?: string;
}

export interface ForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKey[];
}

/** The full database schema — all tables, cached after first introspection. */
export interface FullSchema {
  dialect: string;
  tables: TableInfo[];
  introspectedAt: Date;
}

/** A subset of the full schema selected for relevance to the current question. */
export interface RelevantSchema {
  tables: TableInfo[];
  /** Why these tables were selected (for debugging). */
  selectionReason: string;
}
