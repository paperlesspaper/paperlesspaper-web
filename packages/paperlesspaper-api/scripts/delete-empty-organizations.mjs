#!/usr/bin/env node

import process from 'node:process';
import { MongoClient } from 'mongodb';

function parseArgs(argv) {
  const args = {
    execute: false,
    batchSize: 500,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--execute') {
      args.execute = true;
      continue;
    }

    if (token === '--batch-size' && argv[i + 1]) {
      args.batchSize = Number(argv[i + 1]) || args.batchSize;
      i += 1;
      continue;
    }

    if (token.startsWith('--batch-size=')) {
      args.batchSize = Number(token.slice('--batch-size='.length)) || args.batchSize;
      continue;
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log('Usage: yarn mongo:delete-empty-organizations [--execute] [--batch-size <n>]');
  console.log('');
  console.log('Deletes organizations that have no users referencing them via users.organization.');
  console.log('');
  console.log('Options:');
  console.log('  --execute          Actually delete matching organizations. Without this, dry-run only.');
  console.log('  --batch-size <n>   Delete batch size (default: 500).');
  console.log('  --help, -h         Show this help.');
}

async function findEmptyOrganizationIds(db) {
  return db.collection('organizations')
    .aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'organization',
          as: 'users',
        },
      },
      {
        $match: {
          users: { $size: 0 },
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ], { allowDiskUse: true })
    .map((doc) => doc._id)
    .toArray();
}

async function deleteInBatches(collection, ids, batchSize) {
  let deletedCount = 0;

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const result = await collection.deleteMany({ _id: { $in: batch } });
    deletedCount += result.deletedCount;
    console.log(`Deleted ${deletedCount}/${ids.length} organizations...`);
  }

  return deletedCount;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error('Missing MONGODB_URL in environment.');
  }

  const client = new MongoClient(mongoUrl);

  await client.connect();

  try {
    const db = client.db();
    const organizations = db.collection('organizations');
    const emptyOrganizationIds = await findEmptyOrganizationIds(db);

    console.log(`Database: ${db.databaseName}`);
    console.log(`Organizations with 0 users: ${emptyOrganizationIds.length}`);

    if (emptyOrganizationIds.length === 0) {
      return;
    }

    console.log('First matching organization ids:');
    for (const id of emptyOrganizationIds.slice(0, 20)) {
      console.log(`- ${id.toString()}`);
    }

    if (!args.execute) {
      console.log('');
      console.log('Dry-run only. Re-run with --execute to delete these organizations.');
      return;
    }

    const deletedCount = await deleteInBatches(organizations, emptyOrganizationIds, args.batchSize);
    console.log(`Done. Deleted ${deletedCount} organizations.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
