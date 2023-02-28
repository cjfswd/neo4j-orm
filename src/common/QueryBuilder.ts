import { Session, Transaction, Record } from 'neo4j-driver';
import { Dict } from 'neo4j-driver-core/types/record';

type OrderByDirection = 'ASC' | 'DESC';
type Params = { [key: string]: any };
type QueryPart = [string, Params];
type QueryParts = QueryPart[];

export class Neo4jQueryBuilder<T extends QueryParts = []> {
  private queryParts: T;

  constructor(queryParts: T = [] as unknown as T) {
    this.queryParts = queryParts;
  }

  select<K extends string>(
    ...columns: K[]
  ): Neo4jQueryBuilder<[...T, ['SELECT', { columns: K[] }]]> {
    return new Neo4jQueryBuilder([...this.queryParts, ['SELECT', { columns }]]);
  }

  match<K extends string>(
    node: K,
    params: Params = {},
  ): Neo4jQueryBuilder<[...T, ['MATCH', { node: K; params: Params }]]> {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['MATCH', { node, params }],
    ]);
  }

  with<K extends string>(
    node: K,
    params: Params = {},
  ): Neo4jQueryBuilder<[...T, ['WITH', { node: K; params: Params }]]> {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['WITH', { node, params }],
    ]);
  }

  call<K extends string>(
    node: K,
    params: Params = {},
  ): Neo4jQueryBuilder<[...T, ['CALL', { node: K; params: Params }]]> {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['CALL', { node, params }],
    ]);
  }

  yield<K extends string>(
    node: K,
    params: Params = {},
  ): Neo4jQueryBuilder<[...T, ['YIELD', { node: K; params: Params }]]> {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['YIELD', { node, params }],
    ]);
  }

  where(
    condition: string,
    params: Params = {},
  ): Neo4jQueryBuilder<
    [...T, ['WHERE', { condition: string; params: Params }]]
  > {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['WHERE', { condition, params }],
    ]);
  }

  set(
    properties: string,
    params: Params = {},
  ): Neo4jQueryBuilder<
    [...T, ['SET', { properties: string; params: Params }]]
  > {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['SET', { properties, params }],
    ]);
  }

  create(
    node: string,
    params: Params = {},
  ): Neo4jQueryBuilder<[...T, ['CREATE', { node: string; params: Params }]]> {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['CREATE', { node, params }],
    ]);
  }

  delete(
    node: string,
  ): Neo4jQueryBuilder<[...T, ['DELETE', { node: string }]]> {
    return new Neo4jQueryBuilder([...this.queryParts, ['DELETE', { node }]]);
  }

  orderBy<K extends string>(
    column: K,
    direction: OrderByDirection = 'ASC',
  ): Neo4jQueryBuilder<
    [...T, ['ORDER BY', { column: K; direction: OrderByDirection }]]
  > {
    return new Neo4jQueryBuilder([
      ...this.queryParts,
      ['ORDER BY', { column, direction }],
    ]);
  }

  return<Keys extends string>(
    ...keys: Keys[]
  ): Neo4jQueryBuilder<[...T, ['RETURN', { keys: Keys[] }]]> {
    return new Neo4jQueryBuilder([...this.queryParts, ['RETURN', { keys }]]);
  }

  build(): { query: string; params: Params } {
    const { query, params } = this.queryParts.reduce(
      (acc, [part, partParams]) => {
        let cypherString = '';
        switch (part) {
          case 'SELECT': {
            const columns = partParams.columns as [string];
            const columnString =
              columns.length > 1 ? columns.join(', ') : columns[0];
            cypherString = `SELECT ${columnString} `;
            break;
          }
          case 'MATCH': {
            cypherString = `MATCH ${partParams.node} `;
            break;
          }
          case 'WITH': {
            cypherString = `WITH ${partParams.node} `;
            break;
          }
          case 'CALL': {
            cypherString = `CALL ${partParams.node} `;
            break;
          }
          case 'WHERE': {
            cypherString = `WHERE ${partParams.condition} `;
            break;
          }
          case 'SET': {
            cypherString = `SET ${partParams.properties} `;
            break;
          }
          case 'CREATE': {
            cypherString = `CREATE ${partParams.node} `;
            break;
          }
          case 'DELETE': {
            cypherString = `DELETE ${partParams.node} `;
            break;
          }
          case 'ORDER BY': {
            cypherString = `ORDER BY ${partParams.column} ${partParams.direction} `;
            break;
          }
          case 'RETURN': {
            const keys = partParams.keys as [string];
            const keysString = keys.length > 1 ? keys.join(', ') : keys[0];
            cypherString = `RETURN ${keysString} `;
            break;
          }
          default: {
            console.log(`Invalid query part: ${part}`);
          }
        }
        return {
          query: acc.query + cypherString,
          params: { ...acc.params, ...partParams.params },
        };
      },
      { query: '', params: {} },
    );
    return { query, params };
  }

  async execute(
    session: Session,
    useTransaction = false,
  ): Promise<Record<Dict, PropertyKey, Dict<PropertyKey, number>>[]> {
    const { query, params } = this.build();
    if (!useTransaction) {
      try {
        const result = await session.run(query, params);
        return result.records;
      } catch (error) {
        throw error;
      }
    } else {
      const transaction: Transaction = session.beginTransaction();
      try {
        const result = await transaction.run(query, params);
        await transaction.commit();
        return result.records;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }
  }
}
