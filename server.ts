import app from './src/http/app';
import config from './config/default';
import log from './src/logging/logger';
import connectdb from './src/database/connect';

const port: number = Number(config.port);
connectdb();

app.listen(port, () => {
  log.info(`${config.appName} is running on port ${port}`);
});
