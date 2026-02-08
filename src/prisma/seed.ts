import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@schooladmission.com' },
    update: {},
    create: {
      email: 'admin@schooladmission.com',
      passwordHash: adminPassword,
      name: 'Admin User'
    }
  });
  console.log('Admin user created');

  // Seed Schools (sample data - replace with actual from prospectus)
  const schools = [
    { code: 'SCH001', name: 'Government Higher Secondary School, Trivandrum', nameMl: 'സർക്കാർ ഹയർ സെക്കൻഡറി സ്കൂൾ, തിരുവനന്തപുരം' },
    { code: 'SCH002', name: 'St. Mary\'s HSS, Kochi', nameMl: 'സെന്റ് മേരീസ് എച്ച്.എസ്.എസ്., കൊച്ചി' },
    { code: 'SCH003', name: 'Kendriya Vidyalaya, Calicut', nameMl: 'കേന്ദ്രീയ വിദ്യാലയം, കോഴിക്കോട്' },
  ];

  for (const school of schools) {
    await prisma.seedData.upsert({
      where: { type_code_unique: { type: 'SCHOOL', code: school.code } },
      update: {},
      create: {
        type: 'SCHOOL',
        code: school.code,
        name: school.name,
        nameMl: school.nameMl
      }
    });
  }
  console.log(`Seeded ${schools.length} schools`);

  // Seed Combinations (sample data)
  const combinations = [
    { code: 'COM001', name: 'Science (PCM)', nameMl: 'സയൻസ് (PCM)' },
    { code: 'COM002', name: 'Science (PCB)', nameMl: 'സയൻസ് (PCB)' },
    { code: 'COM003', name: 'Commerce', nameMl: 'കൊമേഴ്സ്' },
    { code: 'COM004', name: 'Humanities', nameMl: 'ഹ്യൂമാനിറ്റീസ്' },
  ];

  for (const combo of combinations) {
    await prisma.seedData.upsert({
      where: { type_code_unique: { type: 'COMBINATION', code: combo.code } },
      update: {},
      create: {
        type: 'COMBINATION',
        code: combo.code,
        name: combo.name,
        nameMl: combo.nameMl
      }
    });
  }
  console.log(`Seeded ${combinations.length} combinations`);

  // Seed Categories
  const categories = [
    { code: 'GEN', name: 'General', nameMl: 'സാധാരണ' },
    { code: 'SC', name: 'Scheduled Caste', nameMl: 'പട്ടികജാതി' },
    { code: 'ST', name: 'Scheduled Tribe', nameMl: 'പട്ടികവർഗം' },
    { code: 'OBC', name: 'Other Backward Class', nameMl: 'മറ്റ് പിന്നോക്ക വിഭാഗം' },
    { code: 'EWS', name: 'Economically Weaker Section', nameMl: 'സാമ്പത്തികമായി ദുർബലമായ വിഭാഗം' },
  ];

  for (const category of categories) {
    await prisma.seedData.upsert({
      where: { type_code_unique: { type: 'CATEGORY', code: category.code } },
      update: {},
      create: {
        type: 'CATEGORY',
        code: category.code,
        name: category.name,
        nameMl: category.nameMl
      }
    });
  }
  console.log(`Seeded ${categories.length} categories`);

  // Seed Districts (Kerala)
  const districts = [
    { code: 'TVM', name: 'Thiruvananthapuram', nameMl: 'തിരുവനന്തപുരം' },
    { code: 'KLM', name: 'Kollam', nameMl: 'കൊല്ലം' },
    { code: 'PTA', name: 'Pathanamthitta', nameMl: 'പത്തനംതിട്ട' },
    { code: 'ALP', name: 'Alappuzha', nameMl: 'ആലപ്പുഴ' },
    { code: 'KTM', name: 'Kottayam', nameMl: 'കോട്ടയം' },
    { code: 'IDK', name: 'Idukki', nameMl: 'ഇടുക്കി' },
    { code: 'EKM', name: 'Ernakulam', nameMl: 'എറണാകുളം' },
    { code: 'TSR', name: 'Thrissur', nameMl: 'തൃശ്ശൂർ' },
    { code: 'PLK', name: 'Palakkad', nameMl: 'പാലക്കാട്' },
    { code: 'MLP', name: 'Malappuram', nameMl: 'മലപ്പുറം' },
    { code: 'KKD', name: 'Kozhikode', nameMl: 'കോഴിക്കോട്' },
    { code: 'WYD', name: 'Wayanad', nameMl: 'വയനാട്' },
    { code: 'KNR', name: 'Kannur', nameMl: 'കണ്ണൂർ' },
    { code: 'KSD', name: 'Kasaragod', nameMl: 'കാസർഗോഡ്' },
  ];

  for (const district of districts) {
    await prisma.seedData.upsert({
      where: { type_code_unique: { type: 'DISTRICT', code: district.code } },
      update: {},
      create: {
        type: 'DISTRICT',
        code: district.code,
        name: district.name,
        nameMl: district.nameMl
      }
    });
  }
  console.log(`Seeded ${districts.length} districts`);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
