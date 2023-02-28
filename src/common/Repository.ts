import { Session } from 'neo4j-driver';
import { Neo4jData, Neo4jQueryBuilder } from '../package.module';

export class Neo4jRepository<T extends Neo4jData<unknown>> {
  constructor(public label: string, public queryBuilder: Neo4jQueryBuilder) {}

  async create(session: Session, node: T): Promise<T & { id: string }> {
    const query = this.queryBuilder
      .create(`(n:${this.label} $node)`, { node })
      .return('n');
    const records = await query.execute(session, true);
    const [record] = records;
    const { n } = record.toObject();
    return n.properties;
  }

  async findBy<K extends keyof T>(
    session: Session,
    attribute: K,
    value: T[K],
  ): Promise<T[]> {
    const query = this.queryBuilder
      .match(`(n:${this.label})`)
      .where(`n.${attribute as string} = $value`, { value })
      .return('n');
    const records = await query.execute(session);
    return records.map((item) => {
      const { n } = item.toObject();
      return n.properties;
    });
  }

  async findById(session: Session, id: T['id']) {
    const query = this.queryBuilder
      .match(`(n:${this.label} {id:$id})`, { id })
      .return('n');
    const records = await query.execute(session);
    if (records.length == 0) return null;
    const [record] = records;
    const { n } = record.toObject();
    return n.properties;
  }

  async findAll(session: Session): Promise<T[]> {
    const query = this.queryBuilder.match(`(n:${this.label})`).return('n');
    const records = await query.execute(session);
    return records.map((item) => {
      const { n } = item.toObject();
      return n.properties;
    });
  }

  async updateById(
    session: Session,
    id: T['id'],
    node: Partial<T>,
  ): Promise<T | null> {
    const query = this.queryBuilder
      .match(`(n:${this.label} {id:$id})`, { id })
      .set('n += $node', { node })
      .return('n');
    const records = await query.execute(session);
    if (records.length == 0) return null;
    const [record] = records;
    const { n } = record.toObject();
    return n.properties;
  }

  async deleteById(session: Session, id: T['id']): Promise<void> {
    const query = this.queryBuilder
      .match(`(n:${this.label} {id: $id})`, { id })
      .delete('n');
    await query.execute(session);
  }
}
