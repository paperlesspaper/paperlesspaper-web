#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Redis from 'ioredis';

function parseArgs(argv) {
  const args = {
    out: null,
    pattern: '*',
    raw: false,
    count: 500,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--out' && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }

    if (token.startsWith('--out=')) {
      args.out = token.slice('--out='.length);
      continue;
    }

    if (token === '--pattern' && argv[i + 1]) {
      args.pattern = argv[i + 1];
      i += 1;
      continue;
    }

    if (token.startsWith('--pattern=')) {
      args.pattern = token.slice('--pattern='.length);
      continue;
    }

    if (token === '--count' && argv[i + 1]) {
      args.count = Number(argv[i + 1]) || 500;
      i += 1;
      continue;
    }

    if (token.startsWith('--count=')) {
      args.count = Number(token.slice('--count='.length)) || 500;
      continue;
    }

    if (token === '--raw') {
      args.raw = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function maybeParseJson(value, rawMode) {
  if (rawMode || typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseStringArray(values, rawMode) {
  return values.map((entry) => maybeParseJson(entry, rawMode));
}

function parseHashObject(hash, rawMode) {
  const result = {};

  for (const [field, value] of Object.entries(hash)) {
    result[field] = maybeParseJson(value, rawMode);
  }

  return result;
}

async function getKeyValue(redis, key, keyType, rawMode) {
  if (keyType === 'string') {
    const value = await redis.get(key);
    return maybeParseJson(value, rawMode);
  }

  if (keyType === 'hash') {
    const value = await redis.hgetall(key);
    return parseHashObject(value, rawMode);
  }

  if (keyType === 'list') {
    const value = await redis.lrange(key, 0, -1);
    return parseStringArray(value, rawMode);
  }

  if (keyType === 'set') {
    const value = await redis.smembers(key);
    return parseStringArray(value, rawMode);
  }

  if (keyType === 'zset') {
    const items = await redis.zrange(key, 0, -1, 'WITHSCORES');
    const result = [];
    for (let i = 0; i < items.length; i += 2) {
      result.push({
        member: maybeParseJson(items[i], rawMode),
        score: Number(items[i + 1]),
      });
    }
    return result;
  }

  if (keyType === 'stream') {
    const entries = await redis.xrange(key, '-', '+');
    return entries.map(([id, rawFields]) => {
      const fields = {};
      for (let i = 0; i < rawFields.length; i += 2) {
        fields[rawFields[i]] = maybeParseJson(rawFields[i + 1], rawMode);
      }
      return { id, fields };
    });
  }

  return { unsupportedType: keyType };
}

async function scanKeys(redis, pattern, count) {
  let cursor = '0';
  const allKeys = [];

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', String(count));
    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== '0');

  return allKeys;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: yarn redis:export [--out <file>] [--pattern <glob>] [--count <n>] [--raw]');
    console.log('');
    console.log('Options:');
    console.log('  --out <file>      Output JSON path (default: redis-export-<timestamp>.json)');
    console.log('  --pattern <glob>  Export only matching keys (default: *)');
    console.log('  --count <n>       Redis SCAN COUNT hint (default: 500)');
    console.log('  --raw             Keep values as raw strings (disable JSON auto-parse)');
    console.log('  --help, -h        Show this help');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultOutputFile = `redis-export-${timestamp}.json`;
  const outFile = path.resolve(process.cwd(), args.out || defaultOutputFile);
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl && !(process.env.REDIS_HOST && process.env.REDIS_PORT)) {
    throw new Error('Missing REDIS_URL or REDIS_HOST/REDIS_PORT in environment.');
  }

  const redis = redisUrl
    ? new Redis(redisUrl, { maxRetriesPerRequest: null })
    : new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

  try {
    console.log(`Scanning keys with pattern "${args.pattern}"...`);
    const [allKeys, dbSize] = await Promise.all([
      scanKeys(redis, args.pattern, args.count),
      redis.dbsize(),
    ]);
    console.log(`Found ${allKeys.length} keys (dbsize=${dbSize}).`);

    const stream = fs.createWriteStream(outFile, { encoding: 'utf8' });
    stream.write('{\n');
    stream.write(`  "meta": ${JSON.stringify({
      exportedAt: new Date().toISOString(),
      keyPattern: args.pattern,
      keyCount: allKeys.length,
      dbSize,
      parseJson: !args.raw,
    })},\n`);
    stream.write('  "keys": [\n');

    let isFirst = true;

    for (let index = 0; index < allKeys.length; index += 1) {
      const key = allKeys[index];
      const [keyType, pttl] = await Promise.all([redis.type(key), redis.pttl(key)]);

      let record;
      try {
        const value = await getKeyValue(redis, key, keyType, args.raw);
        record = {
          key,
          type: keyType,
          pttl,
          value,
        };
      } catch (error) {
        record = {
          key,
          type: keyType,
          pttl,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      stream.write(`${isFirst ? '' : ',\n'}    ${JSON.stringify(record)}`);
      isFirst = false;

      if ((index + 1) % 200 === 0) {
        console.log(`Exported ${index + 1}/${allKeys.length} keys...`);
      }
    }

    stream.write('\n  ]\n');
    stream.write('}\n');

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.end(resolve);
    });

    console.log(`Redis export complete: ${outFile}`);
  } finally {
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
