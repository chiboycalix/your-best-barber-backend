import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import enforce from 'express-sslify';

import config from '../../config/default';
import router from './router/v1/router.module';
import AppException from '../exceptions/AppExceptions';
import { ErrorConverter, ErrorHandler } from './middlewares/errorHandler.middleware';
const app: Application = express();

if(config.env === 'production' || config.env === 'staging') {
    app.use(enforce.HTTPS({ trustProtoHeader: true }));
}

if (config.env === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());
app.use(hpp());
app.use(helmet());
app.use(mongoSanitize());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: 'Too many requests from this IP, please try again in an 15mins!',
});
app.use('/api', limiter);
app.disable('x-powered-by');

app.get('/', (_req, res) => {
  res.send('<b>Welcome to your App!</b>');
});

app.use('/api/v1', router);

app.all('*', (req: Request, _res: Response, next: NextFunction) => {
  return next(
    new AppException(`Cant find ${req.originalUrl} on the server.`, 404)
  );
});

app.use(ErrorConverter);
app.use(ErrorHandler);

export default app;