export type Neo4jData<id> = {
  id: id;
};

export type Neo4jScdlevel2Data<
  scd_id,
  scd_date extends string | number,
  scd_insert_by,
> = {
  scd_id: scd_id;
  scd_create_date: scd_date;
  scd_status: 'active' | 'inactive';
  scd_insert_by: scd_insert_by;
};

export interface Relationship<T extends Neo4jData<unknown>> {
  type: string;
  properties: T;
  startNodeId: unknown;
  endNodeId: unknown;
}

export interface RelationshipProperties {
  [key: string]: unknown;
}

export type GetParametersAndRemoveLastIndex<
  T extends (...args: []) => unknown,
> = [...params: Parameters<T>] extends [...infer Rest, unknown]
  ? [...Rest]
  : never;
