import { Session } from 'neo4j-driver';
import {
  Neo4jScdlevel2Data,
  Neo4jData,
  Neo4jRepository,
} from '../package.module';
import { StrictOmit } from 'ts-essentials';

type EXTENSION = Neo4jData<unknown> &
  Neo4jScdlevel2Data<unknown, string | number, unknown>;
type SCD = Neo4jScdlevel2Data<unknown, string | number, unknown>;

export class Neo4jRepositoryScd<T extends EXTENSION> {
  neo4jRepository: Neo4jRepository<T>;
  readonly type: T = {} as unknown as T;
  private readonly UPDATE_SCD_STATUS_PARAMS: Parameters<
    typeof this.updateScdStatus
  > = [] as unknown as Parameters<typeof this.updateScdStatus>;

  constructor(
    ...neo4jRepositoryArgs: ConstructorParameters<typeof Neo4jRepository<T>>
  ) {
    this.neo4jRepository = new Neo4jRepository<T>(...neo4jRepositoryArgs);
  }

  async create(session: Session, node: T) {
    const nodeData: T = node as unknown as T;
    return await this.neo4jRepository.create(session, nodeData);
  }

  // add id
  async createVersion(
    session: [Session, Session],
    id: T['id'],
    node: T,
  ): Promise<T> {
    // Check if the node with the given ID exists
    const existingNode = await this.neo4jRepository.findById(session[0], id);
    if (!existingNode) {
      throw new Error(`Node with ID ${id} does not exist or is deleted`);
    }
    // Create the new version of the node with the same sid as the most recent version
    const newVersionNode = await this.neo4jRepository.create(session[0], {
      ...node,
      scd_id: existingNode.scd_id,
    });
    // Copy relationships from the existing node to the new version
    const copyRelationQuery = (direction: 'left' | 'right') => {
      return this.neo4jRepository.queryBuilder
        .match(
          `(existingNode:testScd {id: $existingId})${
            direction == 'left' ? '<-' : '-'
          }[r]${direction == 'right' ? '->' : '-'}(related)`,
          { existingId: existingNode.id },
        )
        .match(
          `(newVersionNode:${this.neo4jRepository.label} {id: $newVersionNodeId, scd_id: $newVersionNodeScdId})`,
          {
            newVersionNodeId: newVersionNode.id,
            newVersionNodeScdId: newVersionNode.scd_id,
          },
        )
        .with(`newVersionNode, existingNode, r, type(r) as rel_type, related`)
        .call(
          `apoc.create.relationship(${
            direction == 'right' ? 'newVersionNode' : 'related'
          }, rel_type, properties(r), ${
            direction == 'right' ? 'related' : 'newVersionNode'
          }) YIELD rel`,
        )
        .return('rel');
    };
    await Promise.all([
      copyRelationQuery('left').execute(session[0], true),
      copyRelationQuery('right').execute(session[1], true),
    ]);
    return newVersionNode;
  }

  async findVersions(session: Session, scd_id: T['scd_id']) {
    return await this.neo4jRepository.findBy(session, 'scd_id', scd_id);
  }

  async findVersionsByTimeRange(
    session: Session,
    scd_id: T['scd_id'],
    timeRange: [T['scd_create_date'], T['scd_create_date']],
  ) {
    if (new Date(timeRange[0]).getTime() > new Date(timeRange[1]).getTime())
      throw Error(
        'the first timestamp must be older than the second timestamp.',
      );
    return await this.neo4jRepository
      .findBy(session, 'scd_id', scd_id)
      .then((items) =>
        items.filter(
          (item) =>
            item.scd_create_date >= timeRange[0] &&
            item.scd_create_date <= timeRange[1],
        ),
      );
  }

  async sortVersionsByCreationDate(session: Session, scd_id: T['scd_id']) {
    return await this.neo4jRepository
      .findBy(session, 'scd_id', scd_id)
      .then((items) =>
        items.sort((itemA, itemB) => {
          return (
            new Date(itemB.scd_create_date).getTime() -
            new Date(itemA.scd_create_date).getTime()
          );
        }),
      );
  }

  async getLatestVersion(
    session: Session,
    scd_id: T['scd_id'],
  ): Promise<T | null> {
    const versions = await this.sortVersionsByCreationDate(session, scd_id);
    if (versions.length == 0) return null;
    return versions[0];
  }

  async getLatestActiveVersion(session: Session, scd_id: T['scd_id']) {
    const versions = await this.sortVersionsByCreationDate(session, scd_id);
    const activeVersions = versions.filter((version) => {
      return version.scd_status === 'active';
    });
    return activeVersions[0];
  }

  private async updateScdStatus(
    session: [Session, Session],
    scd_data: Pick<T, keyof SCD> & { id: T['id'] },
  ) {
    const leastNode = await this.getLatestVersion(session[0], scd_data.scd_id);
    if (!leastNode) {
      throw new Error(`Node with SCD_ID ${scd_data.scd_id} does not exist`);
    }
    const currentStatus = leastNode.scd_status;
    if (scd_data.scd_status === currentStatus) {
      throw new Error(
        `Node with SCD_ID ${scd_data.scd_id} is already ${scd_data.scd_status}`,
      );
    }
    // TODO REFACTOR FUNCTION PARAMS TO SUPPORT OBJECT FOR UPDATED VALUES, PUT NEW ID AT CREATION OF VERSION
    return await this.createVersion(session, leastNode.id, {
      ...leastNode,
      ...scd_data,
    });
  }

  async deactivate(
    ...params: [
      (typeof this.UPDATE_SCD_STATUS_PARAMS)[0],
      StrictOmit<(typeof this.UPDATE_SCD_STATUS_PARAMS)[1], 'scd_status'>,
    ]
  ) {
    return await this.updateScdStatus(params[0], {
      ...params[1],
      scd_status: 'inactive',
    });
  }

  async activate(
    ...params: [
      (typeof this.UPDATE_SCD_STATUS_PARAMS)[0],
      StrictOmit<(typeof this.UPDATE_SCD_STATUS_PARAMS)[1], 'scd_status'>,
    ]
  ) {
    return await this.updateScdStatus(params[0], {
      ...params[1],
      scd_status: 'active',
    });
  }
}
