import {
  describe,
  expect,
  test,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { Session } from 'neo4j-driver';
import { Neo4jRepositoryScd, Neo4jQueryBuilder } from '../../package.module';
import { connect } from '../index';

describe('Neo4jRepositoryScd', () => {
  let session1: Session, session2: Session;
  let repo: Neo4jRepositoryScd<{
    scd_status: 'active' | 'inactive';
    scd_insert_by: string;
    scd_id: string;
    scd_create_date: number;
    id: string;
    name: string;
  }>;
  let queryBuilder: Neo4jQueryBuilder;

  beforeAll(async () => {
    [session1, session2] = await Promise.all([connect(), connect()]);
    queryBuilder = new Neo4jQueryBuilder();
    repo = new Neo4jRepositoryScd('Person', queryBuilder);
  });

  afterAll(async () => {
    Promise.all([session1.close(), session2.close()]);
  });

  beforeEach(async () => {
    await session1.run('MATCH (n) DETACH DELETE n');
  });

  describe('create', () => {
    test('creates a new node in the database', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const result = await repo.create(session1, person);
      expect(result).toEqual(person);
      const nodes = await repo.findVersions(session1, result.scd_id);
      expect(nodes).toHaveLength(1);
    });
  });

  describe('createVersion', () => {
    test('creates a new version of an existing node', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const node = await repo.create(session1, person);
      const personUpdate: (typeof repo)['type'] = {
        ...node,
        id: uuidv4(),
        scd_create_date: new Date().getTime(),
        name: 'ellie',
      };
      const updatedNode = await repo.createVersion(
        [session1, session2],
        node.id,
        personUpdate,
      );
      expect(updatedNode).toMatchObject(personUpdate);
      const versions = await repo.findVersions(session1, updatedNode.scd_id);
      expect(versions).toHaveLength(2);
    });

    test('throws an error when the existing node is not found', async () => {
      await expect(
        repo.createVersion(
          [session1, session2],
          'nonexistentId',
          {} as (typeof repo)['type'],
        ),
      ).rejects.toThrowError(
        'Node with ID nonexistentId does not exist or is deleted',
      );
    });
  });

  describe('findVersions', () => {
    test('returns all versions of a node with the given SCD ID', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const node = await repo.create(session1, person);
      const personUpdate: (typeof repo)['type'] = {
        ...node,
        id: uuidv4(),
        scd_create_date: new Date().getTime(),
        name: 'ellie',
      };
      const updatedNode = await repo.createVersion(
        [session1, session2],
        node.id,
        personUpdate,
      );
      const versions = await repo.findVersions(session1, updatedNode.scd_id);
      expect(versions).toHaveLength(2);
      expect(versions).toEqual(expect.arrayContaining([node, updatedNode]));
    });
  });

  describe('findVersionsByTimeRange', () => {
    test('returns all versions of a node with the given SCD ID within a time range', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const createdNode = await repo.create(session1, person);
      const updatedNode = await repo.createVersion(
        [session1, session2],
        createdNode.id,
        { ...person, name: 'newName' },
      );
      const versions = await repo.findVersionsByTimeRange(
        session1,
        createdNode.scd_id,
        [createdNode.scd_create_date, updatedNode.scd_create_date],
      );
      expect(versions).toHaveLength(2);
      expect(versions).toEqual(
        expect.arrayContaining([createdNode, updatedNode]),
      );
    });

    test('returns an error when the start time is after the end time', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const createdNode = await repo.create(session1, person);
      const updatedNode = await repo.createVersion(
        [session1, session2],
        createdNode.id,
        { ...person, name: 'newName' },
      );
      try {
        await repo.findVersionsByTimeRange(session1, createdNode.scd_id, [
          updatedNode.scd_create_date,
          createdNode.scd_create_date,
        ]);
      } catch (error) {
        expect(error).toThrow(
          'the first timestamp must be older than the second timestamp.',
        );
      }
    });
  });

  describe('findCurrentVersion', () => {
    test('returns the current version of a node with the given SCD ID', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const createdNode = await repo.create(session1, person);
      const currentVersion = await repo.getLatestVersion(
        session1,
        createdNode.scd_id,
      );
      expect(currentVersion).toEqual(createdNode);
      const updatedNode = await repo.createVersion(
        [session1, session2],
        createdNode.id,
        {
          ...person,
          id: uuidv4(),
          scd_create_date: new Date().getTime(),
          name: 'newName',
        },
      );
      const newCurrentVersion = await repo.getLatestVersion(
        session1,
        createdNode.scd_id,
      );
      expect(newCurrentVersion).toEqual(updatedNode);
    });

    test("returns null when a node with the given SCD ID doesn't exist", async () => {
      const currentVersion = await repo.getLatestVersion(
        session1,
        'nonexistentId',
      );
      expect(currentVersion).toBeNull();
    });
  });

  describe('sortVersionsByCreationDate', () => {
    test('sorts the versions of a node by creation date in descending order', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const node = await repo.create(session1, person);
      const personUpdate1: (typeof repo)['type'] = {
        ...node,
        id: uuidv4(),
        scd_create_date: new Date().getTime() + 1,
        name: 'ellie',
      };
      const personUpdate2: (typeof repo)['type'] = {
        ...node,
        id: uuidv4(),
        scd_create_date: new Date().getTime() + 2,
        name: 'tess',
      };
      const node1 = await repo.createVersion(
        [session1, session2],
        node.id,
        personUpdate1,
      );
      const node2 = await repo.createVersion(
        [session1, session2],
        node1.id,
        personUpdate2,
      );
      const versions = await repo.findVersions(session1, node2.scd_id);
      const sortedVersions = versions.sort(
        (a, b) => b.scd_create_date - a.scd_create_date,
      );
      expect(versions).toEqual(sortedVersions);
    });
  });

  describe('getLatestActiveVersion', () => {
    test('returns the latest active version of a node with the given SCD ID', async () => {
      const scd_id = uuidv4();
      const person1: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const person2: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'ellie',
        scd_create_date: new Date().getTime() + 1,
        scd_insert_by: scd_id,
        scd_status: 'inactive',
      };
      const person3: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'abby',
        scd_create_date: new Date().getTime() + 2,
        scd_insert_by: scd_id,
        scd_status: 'active',
      };

      const node1 = await repo.create(session1, person1);
      const node2 = await repo.createVersion(
        [session1, session2],
        node1.id,
        person2,
      );
      const node3 = await repo.createVersion(
        [session1, session2],
        node2.id,
        person3,
      );

      const latestActiveVersion = await repo.getLatestActiveVersion(
        session1,
        scd_id,
      );

      expect(latestActiveVersion).toEqual(node3);
    });
  });

  describe('deactivate', () => {
    test('sets the SCD status of the node to inactive', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'active',
      };
      const createdNode = await repo.create(session1, person);
      const deactivatedNode = await repo.deactivate([session1, session2], {
        id: createdNode.id,
        scd_id: createdNode.scd_id,
        scd_create_date: new Date().getTime(),
        scd_insert_by: '',
      });
      expect(deactivatedNode.scd_status).toEqual('inactive');
      const versions = await repo.findVersions(session1, scd_id);
      expect(versions).toHaveLength(2);
      expect(versions).toEqual(
        expect.arrayContaining([createdNode, deactivatedNode]),
      );
    });

    test('throws an error when the node is not found', async () => {
      await expect(
        repo.deactivate([session1, session2], {
          id: '',
          scd_id: '',
          scd_create_date: new Date().getTime(),
          scd_insert_by: '',
        }),
      ).rejects.toThrow();
    });
  });

  describe('activate', () => {
    test('sets the SCD status of the node to active', async () => {
      const scd_id = uuidv4();
      const person: (typeof repo)['type'] = {
        id: uuidv4(),
        scd_id,
        name: 'joel',
        scd_create_date: new Date().getTime(),
        scd_insert_by: scd_id,
        scd_status: 'inactive',
      };
      const createdNode = await repo.create(session1, person);
      const deactivatedNode = await repo.activate([session1, session2], {
        id: createdNode.id,
        scd_id: createdNode.scd_id,
        scd_create_date: new Date().getTime(),
        scd_insert_by: '',
      });
      expect(deactivatedNode.scd_status).toEqual('active');
      const versions = await repo.findVersions(session1, scd_id);
      expect(versions).toHaveLength(2);
      expect(versions).toEqual(
        expect.arrayContaining([createdNode, deactivatedNode]),
      );
    });

    test('throws an error when the node is not found', async () => {
      await expect(
        repo.deactivate([session1, session2], {
          id: '',
          scd_id: '',
          scd_create_date: new Date().getTime(),
          scd_insert_by: '',
        }),
      ).rejects.toThrow();
    });
  });
});
// import { connect, TestInterface, queryBuilder } from '../../index'
// import { describe, expect, test, beforeAll, it } from '@jest/globals';
// import { v4 as uuidv4 } from "uuid";
// import { Neo4jRepositoryScd, Neo4jScdlevel2Data } from '../../_neo4j.module'

// describe('Node CRUD operations', () => {
//     describe('Create method', () => {
//         test('should create a new node in the database with the given properties', () => {
//             // Test code
//         });

//         test('should return the created node with all its properties', () => {
//             // Test code
//         });

//         test('should throw an error when invalid or incomplete data is provided', () => {
//             // Test code
//         });

//         test('should create a node with a unique ID and scd_id property', () => {
//             // Test code
//         });
//     });

//     describe('Create version method', () => {
//         test('should create a new version of an existing node with the given properties', () => {
//             // Test code
//         });

//         test('should give the new version of the node the same scd_id as the most recent version', () => {
//             // Test code
//         });

//         test('should copy the relationships from the existing node to the new version', () => {
//             // Test code
//         });

//         test('should create a new version with a unique ID', () => {
//             // Test code
//         });

//         test('should throw an error when invalid or incomplete data is provided', () => {
//             // Test code
//         });
//     });

//     describe('Find versions method', () => {
//         test('should return all versions of a node with a given scd_id', () => {
//             // Test code
//         });

//         test('should return an empty array when no nodes with the given scd_id are found', () => {
//             // Test code
//         });
//     });

//     describe('Find versions by time range method', () => {
//         test('should return all versions of a node with a given scd_id within a specified time range', () => {
//             // Test code
//         });

//         test('should return an empty array when no nodes with the given scd_id within the specified time range are found', () => {
//             // Test code
//         });
//     });

//     describe('Sort versions by creation date method', () => {
//         test('should return all versions of a node with a given scd_id sorted by their scd_create_date', () => {
//             // Test code
//         });

//         test('should return an empty array when no nodes with the given scd_id are found', () => {
//             // Test code
//         });
//     });

//     describe('Get latest version method', () => {
//         test('should return the latest version of a node with a given scd_id', () => {
//             // Test code
//         });

//         test('should throw an error when no nodes with the given scd_id are found', () => {
//             // Test code
//         });
//     });

//     describe('Get latest active version method', () => {
//         test('should return the latest active version of a node with a given scd_id', () => {
//             // Test code
//         });

//         test('should throw an error when no nodes with the given scd_id are found', () => {
//             // Test code
//         });

//         test('should return an empty array when no active versions of the node with the given scd_id are found', () => {
//             // Test code
//         });
//     });

//     describe('Update Scd Status method', () => {
//         test('updates the scd_status property of the latest version of a node with a given scd_id', async () => {
//         });

//         test('throws an error when no nodes with the given scd_id are found', async () => {
//         });

//         test('throws an error when an invalid scd_status is provided', async () => {
//         });
//     });

// })
