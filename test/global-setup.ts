import * as fs from 'fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as path from 'path';

declare global {
  var __MONGO_URI__: string;
  var __MONGO_SERVER__: MongoMemoryServer;
}

export default async function () {
  console.log('Starting MongoDB Memory Server...');
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  // Store the MongoDB URI in the global scope
  global.__MONGO_URI__ = uri;
  global.__MONGO_SERVER__ = mongo;

  console.log(`MongoDB Memory Server started at: ${uri}`);

  // Set environment variables for testing
  process.env.DB_URL = uri;
  process.env.MONGO_DB_NAME = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';

  // Disable email sending in tests
  process.env.EMAIL_ENABLED = 'false';

  // Create a temporary file to store the MongoDB URI for other processes
  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  fs.writeFileSync(path.join(tempDir, 'mongo-uri.txt'), uri);
}
