const mongoose = require('mongoose');
const logger = require('./logger');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

let connecting;

async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (connecting) {
    return connecting;
  }
  if (!uri) {
    throw new Error('MONGO_URI or MONGODB_URI must be set');
  }
  connecting = mongoose
    .connect(uri, { bufferCommands: false })
    .then(() => {
      logger.info({ msg: 'mongodb_connected' });
      return mongoose.connection;
    })
    .catch((err) => {
      logger.error({ msg: 'mongodb_connect_failed', err: String(err) });
      connecting = null;
      throw err;
    });
  return connecting;
}

module.exports = { connectDb, mongoose };
