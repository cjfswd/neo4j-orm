import { Session } from 'neo4j-driver';
import { Relationship, Neo4jData, Neo4jQueryBuilder } from '../package.module';

export class Neo4jRelationManager<
  J extends {
    startNode: unknown;
    relation: unknown;
    endNode: unknown;
  } = undefined,
  T extends Neo4jData<unknown> = undefined,
> {
  readonly relationProperties: T = {} as unknown as T;
  readonly relationData: {
    startNodeId: T['id'];
    endNodeId: T['id'];
    type: J['relation'];
    properties: T;
  } = {} as unknown as this['relationData'];

  constructor(public labels: J, public neo4jQueryBuilder: Neo4jQueryBuilder) {}

  async create(
    session: Session,
    startNodeId: T['id'],
    endNodeId: T['id'],
    relationProperties: T,
  ): Promise<Relationship<T>> {
    const queryBuilder = this.neo4jQueryBuilder
      .match(`(startNode:${this.labels.startNode} {id:$startNodeId})`, {
        startNodeId,
      })
      .match(`(endNode:${this.labels.endNode} {id:$endNodeId})`, { endNodeId })
      .create(
        `(startNode)-[r:${this.labels.relation} $relationProperties]->(endNode)`,
        { relationProperties },
      )
      .return('r');
    const records = await queryBuilder.execute(session);
    const [record] = records;
    const { type, properties } = record.toObject().r;
    return {
      type,
      properties,
      startNodeId: startNodeId,
      endNodeId: endNodeId,
    };
  }

  async findBy<K extends keyof T>(
    session: Session,
    attribute: K,
    value: T[K],
  ): Promise<Relationship<T>[]> {
    const queryBuilder = this.neo4jQueryBuilder
      .match(
        `(startNode:${this.labels.startNode})-[r:${this.labels.relation}]->(endNode:${this.labels.endNode})`,
      )
      .where(`r.${attribute as string} = $value`, { value })
      .return('r', 'startNode.id as startNodeId', 'endNode.id as endNodeId');
    const records = await queryBuilder.execute(session);
    return records.map((item) => {
      const { r, startNodeId, endNodeId } = item.toObject();
      return {
        type: r.type,
        properties: r.properties,
        startNodeId: startNodeId,
        endNodeId: endNodeId,
      };
    });
  }

  async findById(
    session: Session,
    id: T['id'],
  ): Promise<Relationship<T> | null> {
    const queryBuilder = this.neo4jQueryBuilder
      .match(
        `(startNode:${this.labels.startNode})-[r:${this.labels.relation}]->(endNode:${this.labels.endNode})`,
      )
      .where('r.id = $id', { id })
      .return('r', 'startNode.id as startNodeId', 'endNode.id as endNodeId');
    const records = await queryBuilder.execute(session);
    if (records.length == 0) return null;
    const [record] = records;
    const { r, startNodeId, endNodeId } = record.toObject();
    return {
      type: r.type,
      properties: r.properties,
      startNodeId: startNodeId,
      endNodeId: endNodeId,
    };
  }

  async findAll(session: Session): Promise<Relationship<T>[]> {
    const queryBuilder = this.neo4jQueryBuilder
      .match(
        `(startNode:${this.labels.startNode})-[r:${this.labels.relation}]->(endNode:${this.labels.endNode})`,
      )
      .return('r', 'startNode.id as startNodeId', 'endNode.id as endNodeId');
    const records = await queryBuilder.execute(session);
    return records.map((record) => {
      const { r, startNodeId, endNodeId } = record.toObject();
      return {
        type: r.type,
        properties: r.properties,
        startNodeId: startNodeId,
        endNodeId: endNodeId,
      };
    });
  }

  async updateById(
    session: Session,
    id: T['id'],
    relationProperties: Partial<T>,
  ): Promise<Relationship<T>> {
    const queryBuilder = this.neo4jQueryBuilder
      .match(
        `(startNode:${this.labels.startNode})-[r:${this.labels.relation}]->(endNode:${this.labels.endNode})`,
      )
      .where('r.id = $id', { id })
      .set('r += $relationProperties', { relationProperties })
      .return('r', 'startNode.id as startNodeId', 'endNode.id as endNodeId');
    const records = await queryBuilder.execute(session);
    const [record] = records;
    if (record == undefined) return null;
    const { r, startNodeId, endNodeId } = record.toObject();
    return {
      type: r.type,
      properties: r.properties,
      startNodeId,
      endNodeId,
    };
  }

  async deleteById(
    session: Session,
    id: T['id'],
  ): Promise<Relationship<T> | null> {
    const queryBuilder = this.neo4jQueryBuilder
      .match(
        `(startNode:${this.labels.startNode})-[r:${this.labels.relation} {id:$id}]->(endNode:${this.labels.endNode})`,
        { id },
      )
      .delete('r')
      .return('r', 'startNode.id as startNodeId', 'endNode.id as endNodeId');
    const records = await queryBuilder.execute(session);
    if (records.length == 0) return null;
    const [record] = records;
    const { r, startNodeId, endNodeId } = record.toObject();
    return {
      type: r.type,
      properties: r.properties,
      startNodeId,
      endNodeId,
    };
  }
}
