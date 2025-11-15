import * as fs from 'fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as path from 'path';

declare global {
  var __MONGO_SERVER__: MongoMemoryServer;
}

export default async function () {
  console.log('Stopping MongoDB Memory Server...');

  // Stop MongoDB server
  if (global.__MONGO_SERVER__) {
    await global.__MONGO_SERVER__.stop();
  }

  // Clean up temporary files
  const tempFile = path.join(__dirname, '..', 'temp', 'mongo-uri.txt');
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }

  console.log('MongoDB Memory Server stopped.');
}
