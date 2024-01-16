import mongoose from 'mongoose';
import log from '../logging/logger';
import config from '../../config/default';

const connectdb = async () => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.DATABASE_URL);
    log.info(`${config.appName} 🚀 Connected to Database Successfully`);
  } catch (error) {
    log.error(`${config.appName} ❌ Failed to Connect to Database`);
    log.error(error);
  }
}
export default connectdb;