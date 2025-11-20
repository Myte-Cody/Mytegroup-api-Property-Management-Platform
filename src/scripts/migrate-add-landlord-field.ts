import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Migration script to add landlord field to all landlord-scoped collections.
 *
 * This script:
 * 1. Finds all existing landlords in the database
 * 2. Assigns a default landlord to all existing records
 * 3. Updates the following collections: properties, units, leases, expenses,
 *    maintenancetickets, transactions, invoices, rentalperiods
 *
 * Usage: ts-node src/scripts/migrate-add-landlord-field.ts
 */

async function migrate() {
  try {
    console.log('🚀 Starting landlord field migration...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Get all landlords
    const landlordsCollection = db.collection('landlords');
    const landlords = await landlordsCollection.find({ deleted: { $ne: true } }).toArray();

    if (landlords.length === 0) {
      console.log('❌ No landlords found. Please create at least one landlord first.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Use the first landlord as default
    const defaultLandlordId = landlords[0]._id;
    console.log(`📌 Default Landlord: ${landlords[0].name} (${defaultLandlordId})\n`);

    if (landlords.length > 1) {
      console.log('⚠️  Multiple landlords detected:');
      landlords.forEach((landlord, index) => {
        console.log(`   ${index + 1}. ${landlord.name} (${landlord._id})`);
      });
      console.log(`\n⚠️  All existing data will be assigned to: ${landlords[0].name}`);
      console.log('   You may need to manually reassign data to the correct landlord later.\n');
    }

    // Collections to migrate
    const collections = [
      'properties',
      'units',
      'leases',
      'expenses',
      'maintenancetickets',
      'transactions',
      'invoices',
      'rentalperiods',
    ];

    console.log('🔄 Migrating collections...\n');

    let totalUpdated = 0;

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);

        // Check if collection exists
        const collectionExists = await db.listCollections({ name: collectionName }).hasNext();

        if (!collectionExists) {
          console.log(`⏭️  ${collectionName}: Collection does not exist, skipping...`);
          continue;
        }

        // Count documents without landlord field
        const count = await collection.countDocuments({
          landlord: { $exists: false },
        });

        if (count === 0) {
          console.log(`✅ ${collectionName}: Already migrated (0 documents to update)`);
          continue;
        }

        // Update documents
        const result = await collection.updateMany(
          { landlord: { $exists: false } },
          { $set: { landlord: defaultLandlordId } },
        );

        console.log(`✅ ${collectionName}: Updated ${result.modifiedCount} documents`);
        totalUpdated += result.modifiedCount;
      } catch (error) {
        console.error(`❌ ${collectionName}: Error -`, error.message);
      }
    }

    console.log(`\n✨ Migration complete! Total documents updated: ${totalUpdated}\n`);

    // Verify migration
    console.log('🔍 Verifying migration...\n');
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const collectionExists = await db.listCollections({ name: collectionName }).hasNext();

        if (!collectionExists) {
          continue;
        }

        const remaining = await collection.countDocuments({
          landlord: { $exists: false },
        });

        if (remaining > 0) {
          console.log(`⚠️  ${collectionName}: ${remaining} documents still without landlord field`);
        } else {
          const total = await collection.countDocuments();
          console.log(`✅ ${collectionName}: All ${total} documents have landlord field`);
        }
      } catch (error) {
        console.error(`❌ ${collectionName}: Verification error -`, error.message);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    console.log('✨ Migration complete!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrate();
