import {
  describe,
  beforeAll,
  afterAll,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { Neo4jQueryBuilder, Neo4jRepository } from '../package.module';
import { Session } from 'neo4j-driver';
import { connect } from './index';

describe('Neo4jRepository', () => {
  let session: Session;
  let repo: Neo4jRepository<{ id: string; name: string }>;
  let queryBuilder: Neo4jQueryBuilder;

  beforeAll(async () => {
    session = await connect();
    queryBuilder = new Neo4jQueryBuilder();
    repo = new Neo4jRepository('Person', queryBuilder);
  });

  afterAll(async () => {
    /* close Neo4j session */
    await session.close();
  });

  afterEach(async () => {
    /* delete all created nodes */
    await session.run('MATCH (n) DETACH DELETE n');
  });

  describe('create', () => {
    it('should create a new node', async () => {
      const person = { id: uuidv4(), name: 'John Doe' };
      const result = await repo.create(session, person);

      expect(result.id).toEqual(person.id);
      expect(result.name).toEqual(person.name);

      const nodes = await repo.findAll(session);
      expect(nodes).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should find an existing node by id', async () => {
      const person = { id: uuidv4(), name: 'John Doe' };
      await repo.create(session, person);

      const result = await repo.findById(session, person.id);
      expect(result?.id).toEqual(person.id);
      expect(result?.name).toEqual(person.name);
    });

    it('should return null for non-existing node', async () => {
      const result = await repo.findById(session, uuidv4());
      expect(result).toBeNull();
    });
  });

  describe('findBy', () => {
    it('should find existing nodes by attribute', async () => {
      const person1 = { id: uuidv4(), name: 'John Doe' };
      const person2 = { id: uuidv4(), name: 'Jane Doe' };
      await repo.create(session, person1);
      await repo.create(session, person2);

      const results = await repo.findBy(session, 'name', 'John Doe');
      expect(results).toHaveLength(1);
      expect(results[0].id).toEqual(person1.id);
      expect(results[0].name).toEqual(person1.name);
    });

    it('should return an empty array for non-existing attribute value', async () => {
      const results = await repo.findBy(session, 'name', 'John Doe');
      expect(results).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('should return all nodes', async () => {
      const person1 = { id: uuidv4(), name: 'John Doe' };
      const person2 = { id: uuidv4(), name: 'Jane Doe' };
      await repo.create(session, person1);
      await repo.create(session, person2);

      const results = await repo.findAll(session);
      expect(results).toHaveLength(2);
      expect(results[0].id).toEqual(person1.id);
      expect(results[0].name).toEqual(person1.name);
      expect(results[1].id).toEqual(person2.id);
      expect(results[1].name).toEqual(person2.name);
    });

    it('should return an empty array for no nodes', async () => {
      const results = await repo.findAll(session);
      expect(results).toHaveLength(0);
    });
  });

  describe('updateById', () => {
    it('should update a node by id', async () => {
      // Create a test node
      const createNode = await repo.create(session, {
        id: '1',
        name: 'TestName',
      });
      // Update the node by id
      const updatedNode = await repo.updateById(session, createNode.id, {
        name: 'UpdatedTestNode',
      });

      expect(updatedNode).toBeDefined();
      expect(updatedNode?.name).toBe('UpdatedTestNode');
    });

    it('should return null if the node is not found', async () => {
      const updatedNode = await repo.updateById(session, 'non-existent-id', {
        name: 'UpdatedTestNode',
      });

      expect(updatedNode).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('deletes a node with the given ID', async () => {
      // Create a node to delete
      const node = { id: '123', name: 'John Doe' };
      await repo.create(session, node);

      // Delete the node
      await repo.deleteById(session, '123');

      // Check that the node no longer exists
      const deletedNode = await repo.findById(session, '123');
      expect(deletedNode).toBeNull();
    });

    it('does nothing if the ID does not exist', async () => {
      // Delete a nonexistent node
      await repo.deleteById(session, '456');

      // Check that no nodes were deleted
      const nodes = await repo.findAll(session);
      expect(nodes.length).toBe(0);
    });
  });
});
