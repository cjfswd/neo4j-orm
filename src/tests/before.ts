import neo4j from 'neo4j-driver';
import { spawnSync } from 'child_process';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectToNeo4j() {
  const uri = 'bolt://neo4j:7687';
  const user = 'neo4j';
  const password = 'password';
  const maxAttempts = 30;
  const retryInterval = 2000;

  for (let i = 1; i <= maxAttempts; i++) {
    console.log(`Connecting to Neo4j... Attempt ${i}`);
    try {
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      const session = driver.session();
      await session.run('MATCH (n) RETURN count(n)');
      console.log('Connected to Neo4j!');
      await session.close();
      await driver.close();
      return;
    } catch (error) {
      console.log(`Failed to connect to Neo4j: ${error.message}`);
      await sleep(retryInterval);
    }
  }
  throw new Error('Failed to connect to Neo4j');
}


function runScript(scriptName) {
  const packageManager = spawnSync('which', ['pnpm']).status === 0 ? 'pnpm' : 'npm';
  console.log(`Using ${packageManager} to run ${scriptName}...`);

  const child = spawnSync(packageManager, ['run', scriptName], { stdio: 'inherit' });

  if (child.status !== 0) {
    console.error(`${scriptName} failed with exit code ${child.status}`);
    process.exit(1);
  }
}

connectToNeo4j()
  .then(() => {
    runScript('test');
  })
  .catch(() => {
    throw Error('All Attempts failed');
  });
