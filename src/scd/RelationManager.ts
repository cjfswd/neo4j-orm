import { Session } from 'neo4j-driver';
import {
  Neo4jRelationManager,
  Neo4jData,
  Neo4jScdlevel2Data,
} from '../package.module';
import { StrictOmit } from 'ts-essentials';

type EXTENSION = Neo4jData<unknown> &
  Neo4jScdlevel2Data<unknown, string | number, unknown>;
type SCD = Neo4jScdlevel2Data<unknown, string | number, unknown>;

export class Neo4jRelationManagerScd<
  J extends {
    startNode: unknown;
    relation: unknown;
    endNode: unknown;
  } = undefined,
  T extends Neo4jData<unknown> & EXTENSION = undefined,
> {
  readonly relationProperties: T = {} as unknown as T;
  readonly relationData: {
    startNodeId: T['id'];
    endNodeId: T['id'];
    type: J['relation'];
    properties: T;
  } = {} as unknown as this['relationData'];
  neo4jRelationManager: Neo4jRelationManager<J, T>;
  private readonly UPDATE_SCD_STATUS_PARAMS: Parameters<
    typeof this.updateScdStatus
  > = [] as unknown as Parameters<typeof this.updateScdStatus>;

  constructor(
    ...neo4jRelationManagerArgs: ConstructorParameters<
      typeof Neo4jRelationManager<J, T>
    >
  ) {
    this.neo4jRelationManager = new Neo4jRelationManager<J, T>(
      ...neo4jRelationManagerArgs,
    );
  }

  async create(...params: Parameters<Neo4jRelationManager<J, T>['create']>) {
    return await this.neo4jRelationManager.create(...params);
  }

  async createVersion(session: Session, id: T['id'], relation: T) {
    // Check if the relation with the given ID exists
    const existingRelation = await this.neo4jRelationManager.findById(
      session,
      id,
    );
    if (!existingRelation) {
      throw new Error(`Relation with ID ${id} does not exist or is deleted`);
    }
    // Create the new version of the relation with the same sid as the most recent version
    return await this.create(
      session,
      existingRelation.startNodeId,
      existingRelation.endNodeId,
      { ...relation, scd_id: existingRelation.properties.scd_id },
    );
  }

  async findVersions(session: Session, scd_id: T['scd_id']) {
    return await this.neo4jRelationManager.findBy(session, 'scd_id', scd_id);
  }

  async findVersionsByTimeRange(
    session: Session,
    scd_id: T['scd_id'],
    timeRange: [T['scd_create_date'], T['scd_create_date']],
  ) {
    return await this.neo4jRelationManager
      .findBy(session, 'scd_id', scd_id)
      .then((items) =>
        items.filter(
          (item) =>
            item.properties.scd_create_date >= timeRange[0] &&
            item.properties.scd_create_date <= timeRange[1],
        ),
      );
  }

  async getVersionsByCreationDate(session: Session, scd_id: T['scd_id']) {
    return await this.neo4jRelationManager
      .findBy(session, 'scd_id', scd_id)
      .then((items) =>
        items.sort(
          (itemA, itemB) =>
            new Date(itemB.properties.scd_create_date).getTime() -
            new Date(itemA.properties.scd_create_date).getTime(),
        ),
      );
  }

  async getLatestVersion(session: Session, scd_id: T['scd_id']) {
    return await this.getVersionsByCreationDate(session, scd_id).then(
      (items) => items[0],
    );
  }

  async getLatestActiveVersion(session: Session, scd_id: T['scd_id']) {
    const versions = await this.getVersionsByCreationDate(session, scd_id);
    if (versions.length == 0) return null;
    const activeVersions = versions.filter((version) => {
      return version.properties.scd_status === 'active';
    });
    if (activeVersions.length == 0) return null;
    return activeVersions[0];
  }

  private async updateScdStatus(
    session: Session,
    scd_data: Pick<T, keyof SCD> & { id: T['id'] },
  ) {
    const leastNode = await this.getLatestVersion(session, scd_data.scd_id);
    if (!leastNode) {
      throw new Error(`Node with SCD_ID ${scd_data.scd_id} does not exist`);
    }
    const currentStatus = leastNode.properties.scd_status;
    if (scd_data.scd_status === currentStatus) {
      throw new Error(
        `Node with SCD_ID ${scd_data.scd_id} is already ${scd_data.scd_status}`,
      );
    }
    return await this.createVersion(session, leastNode.properties.id, {
      ...leastNode.properties,
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
