/**
 * Import HSCAP seed data (schools, combinations, categories, districts, taluks, panchayats)
 * from a JSON file into the SeedData table.
 *
 * Usage: npx tsx src/scripts/import-hscap-data.ts <path-to-data.json>
 *
 * JSON format:
 * {
 *   "schools": [ { "code": "SCH001", "name": "School Name", "nameMl": "..." } ],
 *   "combinations": [ { "code": "COM001", "name": "Science (PCM)", "nameMl": "..." } ],
 *   "categories": [ { "code": "GEN", "name": "General", "nameMl": "..." } ],
 *   "districts": [ { "code": "TVM", "name": "Thiruvananthapuram", "nameMl": "..." } ],
 *   "taluks": [ { "code": "TVM-01", "name": "Thiruvananthapuram", "nameMl": "...", "districtCode": "TVM" } ],
 *   "panchayats": [ { "code": "TVM-01-001", "name": "...", "nameMl": "...", "talukCode": "TVM-01" } ]
 * }
 * All arrays are optional. code and name are required per item; nameMl and metadata (JSON string) are optional.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type SeedDataType = 'SCHOOL' | 'COMBINATION' | 'CATEGORY' | 'DISTRICT' | 'TALUK' | 'PANCHAYAT';

interface SeedItem {
  code: string;
  name: string;
  nameMl?: string;
  metadata?: string;
  districtCode?: string;
  talukCode?: string;
}

interface ImportData {
  schools?: SeedItem[];
  combinations?: SeedItem[];
  categories?: SeedItem[];
  districts?: SeedItem[];
  taluks?: SeedItem[];
  panchayats?: SeedItem[];
}

async function importType(type: SeedDataType, items: SeedItem[]) {
  let count = 0;
  for (const item of items) {
    if (!item.code || !item.name) {
      console.warn(`Skipping invalid ${type} item:`, item);
      continue;
    }
    const metadata: Record<string, string> = {};
    if (item.districtCode) metadata.districtCode = item.districtCode;
    if (item.talukCode) metadata.talukCode = item.talukCode;
    await prisma.seedData.upsert({
      where: { type_code_unique: { type, code: item.code } },
      update: {
        name: item.name,
        nameMl: item.nameMl ?? null,
        metadata: item.metadata ?? (Object.keys(metadata).length ? JSON.stringify(metadata) : null),
      },
      create: {
        type,
        code: item.code,
        name: item.name,
        nameMl: item.nameMl ?? null,
        metadata: item.metadata ?? (Object.keys(metadata).length ? JSON.stringify(metadata) : null),
      },
    });
    count++;
  }
  return count;
}

async function main() {
  const dataPath = process.argv[2];
  if (!dataPath) {
    console.error('Usage: npx tsx src/scripts/import-hscap-data.ts <path-to-data.json>');
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), dataPath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  let data: ImportData;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON:', e);
    process.exit(1);
  }

  console.log('Importing HSCAP seed data...');

  if (data.schools?.length) {
    const n = await importType('SCHOOL', data.schools);
    console.log(`  Schools: ${n}`);
  }
  if (data.combinations?.length) {
    const n = await importType('COMBINATION', data.combinations);
    console.log(`  Combinations: ${n}`);
  }
  if (data.categories?.length) {
    const n = await importType('CATEGORY', data.categories);
    console.log(`  Categories: ${n}`);
  }
  if (data.districts?.length) {
    const n = await importType('DISTRICT', data.districts);
    console.log(`  Districts: ${n}`);
  }
  if (data.taluks?.length) {
    const n = await importType('TALUK', data.taluks);
    console.log(`  Taluks: ${n}`);
  }
  if (data.panchayats?.length) {
    const n = await importType('PANCHAYAT', data.panchayats);
    console.log(`  Panchayats: ${n}`);
  }

  console.log('Import completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
