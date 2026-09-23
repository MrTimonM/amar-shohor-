import mongoose from 'mongoose';
import { env } from './env';
import { log } from './log';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => log.warn('mongo disconnected'));
  mongoose.connection.on('reconnected', () => log.info('mongo reconnected'));

  try {
    await mongoose.connect(env.MONGO_URL, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    log.error('mongo connection failed', { url: redact(env.MONGO_URL), err: String(err) });
    console.error(
      '\nCould not reach MongoDB. Either start it with `docker compose up -d mongo`\n' +
        'or point MONGO_URL at an Atlas cluster in your .env file.\n',
    );
    process.exit(1);
  }

  // Indexes matter here: every map query is geospatial, so a missing 2dsphere
  // turns a 20ms bbox lookup into a full collection scan.
  await mongoose.connection.syncIndexes().catch((err) => log.warn('syncIndexes failed', { err: String(err) }));
  log.info('mongo connected', { db: mongoose.connection.name });
}

const redact = (url: string) => url.replace(/\/\/[^@]*@/, '//***@');
