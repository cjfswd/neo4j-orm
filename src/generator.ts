import path from 'path';
import fs from 'fs/promises';
import commander from '@commander-js/extra-typings';

async function getArchiveNamesInDirectory(dirPath: string): Promise<string[]> {
  const modelNames: string[] = [];

  for (const dirEntry of await fs.readdir(dirPath, { withFileTypes: true })) {
    if (
      dirEntry.isFile() &&
      dirEntry.name.endsWith('.ts') &&
      !dirEntry.name.startsWith('_')
    ) {
      const modelName = dirEntry.name.slice(0, -3);
      modelNames.push(modelName);
    }
  }

  return modelNames;
}

export async function generateNodeInterfaceCode(
  modelNames: string[],
  scd: boolean,
) {
  let code = '';

  for (let i = 0; i < modelNames.length; i++) {
    const modelName = modelNames[i];
    const nodeTypeName = `${modelName}Node`;
    const interfaceName = `${modelName}Model`;
    code += `export interface ${nodeTypeName} extends Neo4jData<string>, ${
      scd ? 'Neo4jScdlevel2Data<string, number, string>, ' : ''
    }IModel.${interfaceName} {}`;

    if (i !== modelNames.length - 1) {
      code += '\n';
    }
  }

  return code;
}

export async function generateInterfaceCode(
  modelNames: string[],
  relationNames: string[],
  scd: boolean,
) {
  let code = '';

  for (let i = 0; i < modelNames.length + relationNames.length; i++) {
    const name =
      i < modelNames.length
        ? modelNames[i]
        : relationNames[i - modelNames.length];
    const isRelation = i >= modelNames.length;

    let typeName = '';
    let interfaceName = '';
    if (!isRelation) {
      typeName = `${name}Node`;
      interfaceName = `${name}Model`;
    } else {
      typeName = `${name}_Relation`;
      interfaceName = `${name}`;
    }

    code += `export interface ${typeName} extends Neo4jData<string>${
      scd ? ', Neo4jScdlevel2Data<string, number, string>' : ''
    }, ${isRelation ? 'IRelation' : 'IModel'}.${interfaceName} {}`;

    if (i !== modelNames.length + relationNames.length - 1) {
      code += '\n';
    }
  }

  return code;
}

export async function generateRepositoryCode(
  modelNames: string[],
  scd: boolean,
) {
  let code = '';

  for (let i = 0; i < modelNames.length; i++) {
    const modelName = modelNames[i];
    const nodeTypeName = `${modelName}Node`;
    const repositoryName = `${modelName}Repository`;

    code += `export const ${repositoryName} = new Neo4j.${
      scd ? 'Neo4jRepositoryScd' : 'Neo4jRepository'
    }<${nodeTypeName}>('${modelName}', queryBuilder);`;

    if (i !== modelNames.length - 1) {
      code += '\n';
    }
  }

  return code;
}

export async function generateRelationInterfaceCode(
  relationNames: string[],
  scd: boolean,
) {
  let code = '';

  for (let i = 0; i < relationNames.length; i++) {
    const relationName = relationNames[i];
    const interfaceRelationName = `${relationName}Relationship`;
    code += `export interface ${interfaceRelationName} extends Neo4jData<string>, ${
      scd ? 'Neo4jScdlevel2Data<string, number, string>, ' : ''
    }IRelationship.${relationName} {}`;

    if (i !== relationName.length - 1) {
      code += '\n';
    }
  }

  return code;
}

export async function generateRelationCode(
  modelNames: string[],
  relationNames: string[],
  scd: boolean,
) {
  let code = '';

  for (let i = 0; i < relationNames.length; i++) {
    const relationName = relationNames[i];
    const relationParts = relationName.split('_');
    const relationTypeName = `${relationName}_Relation`;
    let relationManagerTypeName = `${relationName}_Relation_Manager`;

    if (relationParts[0] === 'X') {
      for (let j = 0; j < modelNames.length; j++) {
        const model = modelNames[j];
        const replacedRelationName = `${model}_${relationParts[1]}_${relationParts[2]}`;
        relationManagerTypeName = `${replacedRelationName}_Relation_Manager`;

        code += `export const ${relationManagerTypeName} = new Neo4j.${
          scd ? 'Neo4jRelationManagerScd' : 'Neo4jRelationManager'
        }<{startNode:'${model}', relation:'${replacedRelationName}', endNode:'${
          relationParts[2]
        }'}, ${relationTypeName}>({startNode:'${model}', relation:'${replacedRelationName}', endNode:'${
          relationParts[2]
        }'}, queryBuilder);`;
        if (j !== modelNames.length - 1) {
          code += '\n';
        }
      }
    } else {
      code += `export const ${relationManagerTypeName} = new Neo4j.${
        scd ? 'Neo4jRelationManagerScd' : 'Neo4jRelationManager'
      }<{startNode:'${
        relationParts[0]
      }', relation:'${relationName}', endNode:'${
        relationParts[2]
      }'}, ${relationTypeName}>({startNode:'${
        relationParts[0]
      }', relation:'${relationName}', endNode:'${
        relationParts[2]
      }'}, queryBuilder);`;
    }

    if (i !== relationNames.length - 1) {
      code += '\n';
    }
  }

  return code;
}

export async function generateRepositories(
  dirModelAbs: string,
  dirRelationAbs: string,
  modelModuleFile: string,
  relationModuleFile: string,
  writeToAbs: string,
  scd: boolean,
) {
  const writeTo = path.resolve(process.cwd(), writeToAbs);
  const dirModel = path.resolve(process.cwd(), dirModelAbs);
  const dirRelation = path.resolve(process.cwd(), dirRelationAbs);
  const modelNames = await getArchiveNamesInDirectory(dirModel);
  const relationNames = await getArchiveNamesInDirectory(dirRelationAbs);
  const interfaceCode = await generateInterfaceCode(
    modelNames,
    relationNames,
    scd,
  );
  const repositoryCode = await generateRepositoryCode(modelNames, scd);
  const relationCode = await generateRelationCode(
    modelNames,
    relationNames,
    scd,
  );

  const modelModulePath = path
    .relative(writeTo, path.join(dirModel, modelModuleFile))
    .replace(/\\/g, '/');
  const relationModulePath = path
    .relative(writeTo, path.join(dirRelation, relationModuleFile))
    .replace(/\\/g, '/');

  return `
import { Neo4jData${scd ? `, Neo4jScdlevel2Data` : ''} } from 'neo4j-orm'
import * as Neo4j from 'neo4j-orm'
import * as IModel from './${modelModulePath}';
import * as IRelation from './${relationModulePath}';

${interfaceCode}

export const queryBuilder = new Neo4j.Neo4jQueryBuilder();

${repositoryCode}
${relationCode}
`;
}

export async function generateLibraryByModels({
  dirModel,
  dirRelation,
  modelModuleFile,
  relationModuleFile,
  writeTo,
  fileName,
  scd,
}: {
  dirModel?: string;
  dirRelation?: string;
  modelModuleFile?: string;
  relationModuleFile?: string;
  writeTo?: string;
  fileName?: string;
  scd?: boolean;
}) {
  if (!dirModel) dirModel = path.join(process.cwd(), 'models');
  if (!dirRelation) dirRelation = path.join(process.cwd(), 'relations');
  if (!modelModuleFile) modelModuleFile = '_models.module';
  if (!relationModuleFile) relationModuleFile = '_relation.module';
  if (!writeTo) writeTo = process.cwd();
  if (!fileName) fileName = 'library';
  if (!scd) scd = false;
  const string = await generateRepositories(
    dirModel,
    dirRelation,
    modelModuleFile,
    relationModuleFile,
    writeTo,
    scd,
  );
  await fs.writeFile(`${writeTo}/${fileName}.ts`, string);
}

const program = new commander.Command();

program
  .option(
    '-d, --dir-model <path>',
    'Directory for models',
    path.join(process.cwd(), 'models'),
  )
  .option(
    '-r, --dir-relation <path>',
    'Directory for relations',
    path.join(process.cwd(), 'relations'),
  )
  .option(
    '-m, --model-module-file <name>',
    'Name of the model module file',
    '_models.module',
  )
  .option(
    '-l, --relation-module-file <name>',
    'Name of the relation module file',
    '_relations.module',
  )
  .option(
    '-w, --write-to <path>',
    'Directory to write the library to',
    process.cwd(),
  )
  .option('-f, --file-name <name>', 'Name of the library file', 'library')
  .option(
    '-s, --scd',
    'Whether to generate slowly changing dimension interfaces/classes',
    false,
  )
  .action(async (args) => {
    await generateLibraryByModels(args).catch((err: Error) => {
      console.error(err, args);
      process.exit(1);
    });
  });

program.parse(process.argv);
