import {
  describe,
  afterAll,
  beforeAll,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { Session } from 'neo4j-driver';
import {
  Neo4jQueryBuilder,
  Neo4jRelationManager,
  Neo4jRepository,
} from '../package.module';
import { v4 as uuidv4 } from 'uuid';
import { connect } from './index';

describe('Neo4jRelationManager', () => {
  let session1: Session, session2: Session, session3: Session;
  let repo: Neo4jRepository<{ id: string; name: string }>;
  const repoLabel = 'Person';
  const relationType = 'Person_Likes_Person';
  let manager: Neo4jRelationManager<
    { startNode: 'Person'; relation: 'Person_Likes_Person'; endNode: 'Person' },
    { id: string; name: string; duplicate: boolean }
  >;
  let queryBuilder: Neo4jQueryBuilder;

  beforeAll(async () => {
    [session1, session2, session3] = await Promise.all([
      connect(),
      connect(),
      connect(),
    ]);
    queryBuilder = new Neo4jQueryBuilder();
    repo = new Neo4jRepository(repoLabel, queryBuilder);
    manager = new Neo4jRelationManager(
      {
        startNode: 'Person',
        relation: 'Person_Likes_Person',
        endNode: 'Person',
      },
      queryBuilder,
    );
  });

  afterAll(async () => {
    await Promise.all([session1.close(), session2.close(), session3.close()]);
  });

  afterEach(async () => {
    await session1.run('MATCH (n) DETACH DELETE n');
  });

  describe('create', () => {
    it('should create a new relationship', async () => {
      const nodeId1 = uuidv4(),
        nodeId2 = uuidv4(),
        relationId = uuidv4();
      const [node1, node2] = await Promise.all([
        await repo.create(session1, { id: nodeId1, name: 'node1' }),
        await repo.create(session2, { id: nodeId2, name: 'node2' }),
      ]);
      const relation = await manager.create(session1, node1.id, node2.id, {
        id: relationId,
        name: 'relation1',
        duplicate: true,
      });
      expect(relation).toEqual({
        startNodeId: node1.id,
        endNodeId: node2.id,
        type: relationType,
        properties: { id: relationId, name: 'relation1', duplicate: true },
      });
      // expect the result to have the correct type, properties, and start/end node IDs
    });
  });

  describe('findBy', () => {
    it('should find relationships by attribute value', async () => {
      const nodeId1 = uuidv4(),
        nodeId2 = uuidv4(),
        relationId1 = uuidv4(),
        relationId2 = uuidv4();
      const [node1, node2] = await Promise.all([
        await repo.create(session1, { id: nodeId1, name: 'node1' }),
        await repo.create(session2, { id: nodeId2, name: 'node2' }),
      ]);
      const relations = await Promise.all([
        manager.create(session1, node1.id, node2.id, {
          id: relationId1,
          name: 'relation1',
          duplicate: true,
        }),
        manager.create(session2, node2.id, node1.id, {
          id: relationId2,
          name: 'relation2',
          duplicate: true,
        }),
      ]);
      const [findById, findByName, findMultiple] = await Promise.all([
        manager.findBy(session1, 'id', relationId1),
        manager.findBy(session2, 'name', 'relation2'),
        manager.findBy(session3, 'duplicate', true),
      ]);
      expect(findById).toEqual(
        expect.arrayContaining([
          {
            startNodeId: node1.id,
            endNodeId: node2.id,
            type: relationType,
            properties: { id: relationId1, name: 'relation1', duplicate: true },
          },
        ]),
      );
      expect(findByName).toEqual(
        expect.arrayContaining([
          {
            startNodeId: node2.id,
            endNodeId: node1.id,
            type: relationType,
            properties: { id: relationId2, name: 'relation2', duplicate: true },
          },
        ]),
      );
      expect(findMultiple).toEqual(expect.arrayContaining(relations));
      // expect the result to have the correct type, properties, and start/end node IDs
    });
  });

  describe('findById', () => {
    it('should find a relationship by ID', async () => {
      const nodeId1 = uuidv4(),
        nodeId2 = uuidv4(),
        relationId = uuidv4();
      const [node1, node2] = await Promise.all([
        await repo.create(session1, { id: nodeId1, name: 'node1' }),
        await repo.create(session2, { id: nodeId2, name: 'node2' }),
      ]);
      const createdRelation = await manager.create(
        session1,
        node1.id,
        node2.id,
        { id: relationId, name: 'relation1', duplicate: true },
      );

      const foundRelation = await manager.findById(
        session1,
        createdRelation.properties.id,
      );
      expect(foundRelation).toEqual({
        startNodeId: node1.id,
        endNodeId: node2.id,
        type: relationType,
        properties: { id: relationId, name: 'relation1', duplicate: true },
      });
    });

    it('should return null if the relationship is not found', async () => {
      const notFoundRelation = await manager.findById(session1, uuidv4());
      expect(notFoundRelation).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all relationships of a certain type', async () => {
      const nodeIds = [uuidv4(), uuidv4(), uuidv4()];
      const [node1, node2, node3] = await Promise.all([
        repo.create(session1, { id: nodeIds[0], name: 'node1' }),
        repo.create(session2, { id: nodeIds[1], name: 'node2' }),
        repo.create(session3, { id: nodeIds[2], name: 'node3' }),
      ]);

      const relationIds = [uuidv4(), uuidv4()];
      await Promise.all([
        manager.create(session1, node1.id, node2.id, {
          id: relationIds[0],
          name: 'relation1',
          duplicate: true,
        }),
        manager.create(session2, node2.id, node3.id, {
          id: relationIds[1],
          name: 'relation2',
          duplicate: false,
        }),
      ]);

      const foundRelations = await manager.findAll(session1);
      expect(foundRelations).toHaveLength(2);
      expect(foundRelations).toContainEqual({
        startNodeId: node1.id,
        endNodeId: node2.id,
        type: relationType,
        properties: { id: relationIds[0], name: 'relation1', duplicate: true },
      });
      expect(foundRelations).toContainEqual({
        startNodeId: node2.id,
        endNodeId: node3.id,
        type: relationType,
        properties: { id: relationIds[1], name: 'relation2', duplicate: false },
      });
    });
  });

  describe('updateById', () => {
    it('should update a relationship by ID', async () => {
      const nodeId1 = uuidv4(),
        nodeId2 = uuidv4(),
        relationId = uuidv4();
      const [node1, node2] = await Promise.all([
        await repo.create(session1, { id: nodeId1, name: 'node1' }),
        await repo.create(session2, { id: nodeId2, name: 'node2' }),
      ]);
      const createdRelation = await manager.create(
        session1,
        node1.id,
        node2.id,
        { id: relationId, name: 'relation1', duplicate: true },
      );

      const updatedRelation = await manager.updateById(
        session1,
        createdRelation.properties.id,
        { duplicate: false },
      );
      expect(updatedRelation).toEqual({
        startNodeId: node1.id,
        endNodeId: node2.id,
        type: relationType,
        properties: { id: relationId, name: 'relation1', duplicate: false },
      });

      const foundRelation = await manager.findById(
        session1,
        createdRelation.properties.id,
      );
      expect(foundRelation).toEqual({
        startNodeId: node1.id,
        endNodeId: node2.id,
        type: relationType,
        properties: { id: relationId, name: 'relation1', duplicate: false },
      });
    });

    it('should return null if the relationship is not found', async () => {
      const notFoundRelation = await manager.updateById(session1, uuidv4(), {
        duplicate: false,
      });
      expect(notFoundRelation).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('should delete a relationship by ID', async () => {
      const nodeId1 = uuidv4();
      const nodeId2 = uuidv4();
      const relationId = uuidv4();
      const [node1, node2] = await Promise.all([
        repo.create(session1, { id: nodeId1, name: 'node1' }),
        repo.create(session2, { id: nodeId2, name: 'node2' }),
      ]);
      await manager.create(session1, node1.id, node2.id, {
        id: relationId,
        name: 'relation1',
        duplicate: true,
      });

      const beforeDeletion = await manager.findById(session1, relationId);
      expect(beforeDeletion).not.toBeNull();

      await manager.deleteById(session1, relationId);

      const afterDeletion = await manager.findById(session1, relationId);
      expect(afterDeletion).toBeNull();
    });

    it('should return null if the relationship is not found', async () => {
      const result = await manager.deleteById(session1, uuidv4());
      expect(result).toBeNull();
    });
  });
});
