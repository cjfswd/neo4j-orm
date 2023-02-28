import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
} from '@jest/globals';
import { Session } from 'neo4j-driver';
import {
  Neo4jRepositoryScd,
  Neo4jRelationManagerScd,
  Neo4jQueryBuilder,
  Neo4jScdlevel2Data,
} from '../../package.module';
import { v4 as uuidv4 } from 'uuid';
import { connect } from '../index';

describe('Neo4jRelationManagerScd', () => {
  let session1: Session, session2: Session;
  const queryBuilder: Neo4jQueryBuilder = new Neo4jQueryBuilder();
  type MOCK_SCD = Neo4jScdlevel2Data<string, number, string> & {
    id: string;
    name: string;
  };
  const repo: Neo4jRepositoryScd<MOCK_SCD> = new Neo4jRepositoryScd(
    'Person',
    queryBuilder,
  );
  const labels = {
    startNode: 'Person' as const,
    relation: 'Person_Likes_Person',
    endNode: 'Person',
  } as const;
  const manager: Neo4jRelationManagerScd<typeof labels, MOCK_SCD> =
    new Neo4jRelationManagerScd(labels, queryBuilder);

  beforeAll(async () => {
    [session1, session2] = await Promise.all([connect(), connect()]);
  });

  afterAll(async () => {
    await Promise.all([session1.close(), session2.close()]);
  });

  beforeEach(async () => {
    await session1.run('MATCH (n) DETACH DELETE n');
  });

  describe('create', () => {
    const MOCK_NODE_DATA1: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'a',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };
    const MOCK_NODE_DATA2: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'b',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };
    const MOCK_RELATION_RESULT_DATA: (typeof manager)['relationData'] = {
      type: 'Person_Likes_Person',
      startNodeId: MOCK_NODE_DATA1.id,
      endNodeId: MOCK_NODE_DATA2.id,
      properties: {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      },
    };

    it('should create an new relation', async () => {
      const node1 = await repo.create(session1, MOCK_NODE_DATA1);
      const node2 = await repo.create(session1, MOCK_NODE_DATA2);

      const relation1 = await manager.create(
        session1,
        node1.id,
        node2.id,
        MOCK_RELATION_RESULT_DATA.properties,
      );
      expect(relation1).toEqual(MOCK_RELATION_RESULT_DATA); // Add assertion here
    });
  });

  describe('createVersion', () => {
    const node1Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'a',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };
    const node2Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'b',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };

    it('should create a new version of a relation', async () => {
      const node1 = await repo.create(session1, node1Data);
      const node2 = await repo.create(session1, node2Data);

      const relation1 = await manager.create(session1, node1.id, node2.id, {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const relationVersion = await manager.createVersion(
        session1,
        relation1.properties.id,
        {
          ...relation1.properties,
          id: uuidv4(),
          scd_create_date: new Date().getTime(),
        },
      );
    });

    it('should throw an error if the relation with the given ID does not exist', async () => {
      const errorQuery = await manager.neo4jRelationManager.findById(
        session1,
        '',
      );
    });
  });

  describe('findVersions', () => {
    it('should return all versions of a given SCD ID', async () => {
      const node1Data: (typeof repo)['type'] = {
        id: uuidv4(),
        name: 'a',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      };
      const node2Data: (typeof repo)['type'] = {
        id: uuidv4(),
        name: 'b',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      };

      const node1 = await repo.create(session1, node1Data);
      const node2 = await repo.create(session1, node2Data);

      const scdId = '123';
      const relation1 = await manager.create(session1, node1.id, node2.id, {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: scdId,
        scd_insert_by: '',
        scd_status: 'active',
      });
      const relationVersion = await manager.createVersion(
        session1,
        relation1.properties.id,
        {
          ...relation1.properties,
          id: uuidv4(),
          scd_create_date: new Date().getTime(),
        },
      );

      const versions = await manager.findVersions(session1, scdId);
      expect(versions.length).toBe(2);
      expect(versions[0].properties.scd_id).toBe(scdId);
      expect(versions[1].properties.scd_id).toBe(scdId);
    });
  });

  describe('findVersionsByTimeRange', () => {
    const testScdId = uuidv4();
    const testCreateDates = [1640995200000, 1641081600000, 1641168000000];

    const node1Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'a',
      scd_create_date: new Date(testCreateDates[0]).getTime(),
      scd_id: testScdId,
      scd_insert_by: '',
      scd_status: 'active' as const,
    };

    const node2Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'b',
      scd_create_date: new Date(testCreateDates[1]).getTime(),
      scd_id: testScdId,
      scd_insert_by: '',
      scd_status: 'active' as const,
    };

    const relation1Data = {
      id: uuidv4(),
      name: 'relation1',
      scd_create_date: new Date(testCreateDates[0]).getTime(),
      scd_id: testScdId,
      scd_insert_by: '',
      scd_status: 'active' as const,
    };

    const relation2Data = {
      id: uuidv4(),
      name: 'relation2',
      scd_create_date: new Date(testCreateDates[2]).getTime(),
      scd_id: testScdId,
      scd_insert_by: '',
      scd_status: 'active' as const,
    };

    it('returns the versions with scd_create_date within the specified range', async () => {
      const node1 = await repo.create(session1, node1Data);
      const node2 = await repo.create(session1, node2Data);

      const relation1 = await manager.create(
        session1,
        node1.id,
        node2.id,
        relation1Data,
      );
      const relation2 = await manager.createVersion(
        session1,
        relation1.properties.id,
        relation2Data,
      );

      const timeRange: [number, number] = [
        testCreateDates[0],
        testCreateDates[2],
      ];
      const versions = await manager.findVersionsByTimeRange(
        session1,
        testScdId,
        timeRange,
      );

      expect(versions).toHaveLength(2);
      expect(new Date(versions[0].properties.scd_create_date).getTime()).toBe(
        new Date(testCreateDates[0]).getTime(),
      );
      expect(new Date(versions[1].properties.scd_create_date).getTime()).toBe(
        new Date(testCreateDates[2]).getTime(),
      );
    });

    it('returns an empty array if no versions are found within the specified range', async () => {
      const timeRange: [number, number] = [
        testCreateDates[1],
        testCreateDates[2],
      ];
      const versions = await manager.findVersionsByTimeRange(
        session1,
        testScdId,
        timeRange,
      );

      expect(versions).toHaveLength(0);
    });
  });

  describe('getVersionsByCreationDate', () => {
    it('should get and sort relation versions by creation date', async () => {
      const node1 = await repo.create(session1, {
        id: uuidv4(),
        name: 'a',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const node2 = await repo.create(session1, {
        id: uuidv4(),
        name: 'b',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const relation = await manager.create(session1, node1.id, node2.id, {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const relationVersion1 = await manager.createVersion(
        session1,
        relation.properties.id,
        {
          ...relation.properties,
          id: uuidv4(),
          scd_create_date: new Date().getTime(),
        },
      );
      const relationVersion2 = await manager.createVersion(
        session1,
        relation.properties.id,
        {
          ...relation.properties,
          id: uuidv4(),
          scd_create_date: new Date().getTime(),
        },
      );

      const sortedVersions = await manager.getVersionsByCreationDate(
        session1,
        relation.properties.scd_id,
      );

      expect(sortedVersions).toEqual(
        expect.arrayContaining([relationVersion2, relationVersion1, relation]),
      );
    });
  });

  describe('getLatestVersion', () => {
    it('should return the latest version of a relation', async () => {
      const node1 = await repo.create(session1, {
        id: uuidv4(),
        name: 'a',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const node2 = await repo.create(session1, {
        id: uuidv4(),
        name: 'b',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const relation1 = await manager.create(session1, node1.id, node2.id, {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const relationVersion = await manager.createVersion(
        session1,
        relation1.properties.id,
        {
          ...relation1.properties,
          id: uuidv4(),
          scd_create_date: new Date().getTime(),
        },
      );
      const latestVersion = await manager.getLatestVersion(
        session1,
        relation1.properties.scd_id,
      );
      expect(latestVersion).toEqual(relationVersion);
    });
  });

  describe('getLatestActiveVersion', () => {
    it('should return the latest active version of a relation', async () => {
      const node1 = await repo.create(session1, {
        id: uuidv4(),
        name: 'a',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const node2 = await repo.create(session1, {
        id: uuidv4(),
        name: 'b',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });

      const relation1 = await manager.create(session1, node1.id, node2.id, {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const relation2 = await manager.createVersion(
        session1,
        relation1.properties.id,
        {
          id: uuidv4(),
          name: 'relation',
          scd_create_date: new Date().getTime(),
          scd_id: relation1.properties.scd_id,
          scd_insert_by: '',
          scd_status: 'inactive',
        },
      );
      const relation3 = await manager.createVersion(
        session1,
        relation1.properties.id,
        {
          id: uuidv4(),
          name: 'relation',
          scd_create_date: new Date().getTime(),
          scd_id: relation1.properties.scd_id,
          scd_insert_by: '',
          scd_status: 'active',
        },
      );

      const latestActiveVersion = await manager.getLatestActiveVersion(
        session1,
        relation1.properties.scd_id,
      );

      expect(latestActiveVersion).toBeDefined();
      expect(latestActiveVersion?.properties.scd_id).toEqual(
        relation3.properties.scd_id,
      );
    });

    it('should return null if no active version of a relation is found', async () => {
      const node1 = await repo.create(session1, {
        id: uuidv4(),
        name: 'a',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });
      const node2 = await repo.create(session1, {
        id: uuidv4(),
        name: 'b',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      });

      const relation1 = await manager.create(session1, node1.id, node2.id, {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'inactive',
      });
      const relation2 = await manager.create(session1, node1.id, node2.id, {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'inactive',
      });

      const latestActiveVersion = await manager.getLatestActiveVersion(
        session1,
        relation1.properties.scd_id,
      );

      expect(latestActiveVersion).toBeNull();
    });
  });

  describe('deactivate', () => {
    const node1Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'a',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };
    const node2Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'b',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };
    const relationData: (typeof manager)['relationData'] = {
      type: 'Person_Likes_Person',
      startNodeId: node1Data.id,
      endNodeId: node2Data.id,
      properties: {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'active',
      },
    };
    it('should deactivate a relation', async () => {
      const node1 = await repo.create(session1, node1Data);
      const node2 = await repo.create(session1, node2Data);
      const relation = await manager.create(
        session1,
        node1.id,
        node2.id,
        relationData.properties,
      );
      const deactivatedRelation = await manager.deactivate(session1, {
        id: relation.properties.id,
        scd_id: relation.properties.scd_id,
        scd_create_date: new Date().getTime(),
        scd_insert_by: '',
      });
      const expectedDeactivatedRelation: typeof deactivatedRelation = {
        ...relation,
        properties: { ...relation.properties, scd_status: 'inactive' },
      };
      expect(deactivatedRelation.properties.scd_status).toEqual(
        expectedDeactivatedRelation.properties.scd_status,
      );
    });
  });

  describe('activate', () => {
    const node1Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'a',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };
    const node2Data: (typeof repo)['type'] = {
      id: uuidv4(),
      name: 'b',
      scd_create_date: new Date().getTime(),
      scd_id: uuidv4(),
      scd_insert_by: '',
      scd_status: 'active',
    };
    const relationData: (typeof manager)['relationData'] = {
      type: 'Person_Likes_Person',
      startNodeId: node1Data.id,
      endNodeId: node2Data.id,
      properties: {
        id: uuidv4(),
        name: 'relation',
        scd_create_date: new Date().getTime(),
        scd_id: uuidv4(),
        scd_insert_by: '',
        scd_status: 'inactive',
      },
    };
    it('should activate a relation', async () => {
      const node1 = await repo.create(session1, node1Data);
      const node2 = await repo.create(session1, node2Data);
      const relation = await manager.create(
        session1,
        node1.id,
        node2.id,
        relationData.properties,
      );
      const activatedRelation = await manager.activate(session1, {
        id: relation.properties.id,
        scd_id: relation.properties.scd_id,
        scd_create_date: new Date().getTime(),
        scd_insert_by: '',
      });
      const expectedActivatedRelation: typeof activatedRelation = {
        ...relation,
        properties: { ...relation.properties, scd_status: 'active' },
      };
      expect(activatedRelation.properties.scd_status).toEqual(
        expectedActivatedRelation.properties.scd_status,
      );
    });
  });
});
// import { connect, TestInterface, queryBuilder } from '../../index'
// import { describe, expect, test, beforeAll, it } from '@jest/globals';
// import { v4 as uuidv4 } from "uuid";
// import { Neo4jRepositoryScd, Neo4jRelationManagerScd, Neo4jScdlevel2Data, Relationship } from '../../_neo4j.module'

// function isSortedByCreationDate(objects: Relationship<TestInterface & Neo4jScdlevel2Data<string | number[], string | number, string | number[]>>[]) {
//     if (objects.length <= 1) {
//         // An array with 0 or 1 elements is always sorted
//         return true;
//     }
//     let prevDate = objects[0].properties.scd_create_date;
//     for (let i = 1; i < objects.length; i++) {
//         const currentDate = objects[i].properties.scd_create_date;
//         if (currentDate > prevDate) {
//             // Array is not sorted by creation date
//             return false;
//         }
//         prevDate = currentDate;
//     }
//     // Array is sorted by creation date
//     return true;
// }

// describe('RelationService', () => {
//     describe('createVersion', () => {
//         it('should create a new version of a relation with the same scd_id as the most recent version', () => {
//             // Test implementation goes here
//         });

//         it('should throw an error when trying to create a new version of a relation with a non-existing ID', () => {
//             // Test implementation goes here
//         });
//     });

//     describe('findVersions', () => {
//         it('should find all versions of a relation with a given scd_id', () => {
//             // Test implementation goes here
//         });
//     });

//     describe('findVersionsByTimeRange', () => {
//         it('should find versions of a relation within a given time range', () => {
//             // Test implementation goes here
//         });
//     });

//     describe('sortVersionsByCreationDate', () => {
//         it('should sort versions of a relation by creation date', () => {
//             // Test implementation goes here
//         });
//     });

//     describe('getLatestVersion', () => {
//         it('should return the latest version of a relation with a given scd_id', () => {
//             // Test implementation goes here
//         });
//     });

//     describe('getLatestActiveVersion', () => {
//         it('should return the latest active version of a relation with a given scd_id', () => {
//             // Test implementation goes here
//         });
//     });

//     describe('deactivate', () => {
//         it('should deactivate the latest version of a relation with a given scd_id', () => {
//             // Test implementation goes here
//         });

//         it('should throw an error when trying to update the scd_status of a non-existing relation', () => {
//             // Test implementation goes here
//         });
//     });

//     describe('activate', () => {
//         it('should activate the latest version of a relation with a given scd_id', () => {
//             // Test implementation goes here
//         });

//         it('should throw an error when trying to update the scd_status of a relation to an invalid value', () => {
//             // Test implementation goes here
//         });
//     });
// });
