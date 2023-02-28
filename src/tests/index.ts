import neo4j from 'neo4j-driver';
import { Session } from 'neo4j-driver';
import { setTimeout } from 'node:timers/promises';
import { Neo4jQueryBuilder } from '../package.module';
import type { Neo4jData } from '../package.module';

export interface TestInterface extends Neo4jData<string | number[]> {
  name: string;
}

// Create a connection pool with a max size of 10 connections
export const driver = neo4j.driver(
  'bolt://neo4j:7687',
  neo4j.auth.basic('neo4j', 'password'),
  {
    maxConnectionPoolSize: 10,
    maxTransactionRetryTime: 3000,
    logging: {
      level: 'info',
      logger: (level, message) =>
        console[level].call(console, `${level.toUpperCase()} ${message}`),
    },
  },
);

export async function connect(): Promise<Session> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 5000;

  for (let retries = 0; retries < MAX_RETRIES; retries++) {
    try {
      const session = driver.session();
      await session.run('RETURN 1');
      console.log('Successfully connected to Neo4j.');
      return session;
    } catch (err) {
      console.error(`Failed to connect to Neo4j: ${err.message}`);
      if (retries === MAX_RETRIES - 1) {
        console.error(`Max retries reached (${MAX_RETRIES}). Giving up.`);
        break;
      }
      console.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await setTimeout(RETRY_DELAY_MS);
    }
  }
  throw new Error(`Unable to connect to Neo4j after ${MAX_RETRIES} attempts`);
}

export const queryBuilder = new Neo4jQueryBuilder();
