import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Script to create database indexes for multi-tenancy.
 *
 * This script creates optimized indexes for all landlord-scoped collections
 * to ensure efficient querying by landlord.
 *
 * Usage: ts-node src/scripts/create-multi-tenancy-indexes.ts
 */

async function createIndexes() {
  try {
    console.log('🚀 Starting index creation for multi-tenancy...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    console.log('🔄 Creating indexes...\n');

    // Properties indexes
    try {
      const properties = db.collection('properties');
      await properties.createIndex({ landlord: 1, name: 1 });
      await properties.createIndex({ landlord: 1, deleted: 1, createdAt: -1 });
      console.log('✅ Properties: Indexes created');
    } catch (error) {
      console.error('❌ Properties: Error creating indexes -', error.message);
    }

    // Units indexes
    try {
      const units = db.collection('units');
      await units.createIndex(
        { landlord: 1, property: 1, unitNumber: 1 },
        { unique: true, name: 'unit_landlord_property_unique' },
      );
      await units.createIndex({ landlord: 1, availabilityStatus: 1 });
      console.log('✅ Units: Indexes created');
    } catch (error) {
      console.error('❌ Units: Error creating indexes -', error.message);
    }

    // Leases indexes
    try {
      const leases = db.collection('leases');
      await leases.createIndex({ landlord: 1, status: 1 });
      await leases.createIndex({ landlord: 1, tenant: 1 });
      console.log('✅ Leases: Indexes created');
    } catch (error) {
      console.error('❌ Leases: Error creating indexes -', error.message);
    }

    // Rental Periods indexes
    try {
      const rentalperiods = db.collection('rentalperiods');
      await rentalperiods.createIndex({ landlord: 1, status: 1 });
      console.log('✅ Rental Periods: Indexes created');
    } catch (error) {
      console.error('❌ Rental Periods: Error creating indexes -', error.message);
    }

    // Expenses indexes
    try {
      const expenses = db.collection('expenses');
      await expenses.createIndex({ landlord: 1, category: 1, date: -1 });
      console.log('✅ Expenses: Indexes created');
    } catch (error) {
      console.error('❌ Expenses: Error creating indexes -', error.message);
    }

    // Maintenance Tickets indexes
    try {
      const maintenancetickets = db.collection('maintenancetickets');
      await maintenancetickets.createIndex({ landlord: 1, status: 1, priority: 1 });
      await maintenancetickets.createIndex({ landlord: 1, assignedContractor: 1 });
      console.log('✅ Maintenance Tickets: Indexes created');
    } catch (error) {
      console.error('❌ Maintenance Tickets: Error creating indexes -', error.message);
    }

    // Transactions indexes
    try {
      const transactions = db.collection('transactions');
      await transactions.createIndex({ landlord: 1, status: 1, dueDate: 1 });
      console.log('✅ Transactions: Indexes created');
    } catch (error) {
      console.error('❌ Transactions: Error creating indexes -', error.message);
    }

    // Invoices indexes
    try {
      const invoices = db.collection('invoices');
      await invoices.createIndex({ landlord: 1, status: 1 });
      await invoices.createIndex({ landlord: 1, issuer: 1 });
      console.log('✅ Invoices: Indexes created');
    } catch (error) {
      console.error('❌ Invoices: Error creating indexes -', error.message);
    }

    console.log('\n✨ All indexes created successfully!\n');

    // List all indexes for verification
    console.log('🔍 Verifying indexes...\n');

    const collections = [
      'properties',
      'units',
      'leases',
      'rentalperiods',
      'expenses',
      'maintenancetickets',
      'transactions',
      'invoices',
    ];

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const collectionExists = await db.listCollections({ name: collectionName }).hasNext();

        if (!collectionExists) {
          console.log(`⏭️  ${collectionName}: Collection does not exist, skipping...`);
          continue;
        }

        const indexes = await collection.indexes();
        const landlordIndexes = indexes.filter((idx) =>
          Object.keys(idx.key).some((key) => key === 'landlord'),
        );

        console.log(`✅ ${collectionName}: ${landlordIndexes.length} landlord-related indexes`);
        landlordIndexes.forEach((idx) => {
          const keys = Object.keys(idx.key)
            .map((k) => `${k}:${idx.key[k]}`)
            .join(', ');
          console.log(`   - ${idx.name || 'unnamed'}: { ${keys} }`);
        });
      } catch (error) {
        console.error(`❌ ${collectionName}: Error listing indexes -`, error.message);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    console.log('✨ Index creation complete!\n');
  } catch (error) {
    console.error('❌ Index creation failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run index creation
createIndexes();
