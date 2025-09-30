import * as fs from 'fs';
import { MongoClient } from 'mongodb';
import * as path from 'path';

declare global {
  var __MONGO_URI__: string;
  var __MONGO_CLIENT__: MongoClient;
  var __MONGO_DB__: any;
}

// Helper function to get MongoDB URI
function getMongoUri(): string {
  // First try to get it from global scope
  if (global.__MONGO_URI__) {
    return global.__MONGO_URI__;
  }

  // If not available in global scope, try to read from file
  const tempFile = path.join(__dirname, '..', 'temp', 'mongo-uri.txt');
  if (fs.existsSync(tempFile)) {
    return fs.readFileSync(tempFile, 'utf8');
  }

  throw new Error('MongoDB URI not found. Make sure global setup has been executed.');
}

beforeAll(async () => {
  // Connect to the in-memory database
  const mongoUri = getMongoUri();
  console.log(`Connecting to MongoDB at: ${mongoUri}`);

  const client = new MongoClient(mongoUri);
  await client.connect();

  // Get the database handle
  const db = client.db(process.env.MONGO_DB_NAME || 'test');

  // Store the database handle in the global scope
  global.__MONGO_CLIENT__ = client;
  global.__MONGO_DB__ = db;

  // Set timeout for tests
  jest.setTimeout(30000);
});

afterAll(async () => {
  // Close the database connection
  if (global.__MONGO_CLIENT__) {
    await global.__MONGO_CLIENT__.close();
  }
});

// Clear all collections after each test
afterEach(async () => {
  if (global.__MONGO_DB__) {
    const collections = await global.__MONGO_DB__.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});
