import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envVarsSchema = Joi.object()
.keys({
  NODE_ENV: Joi.string().required().valid('production', 'staging', 'development', 'test').default('development'),
  DATABASE_URL: Joi.string().required().description('MongoDB url'),
  APP_NAME: Joi.string().required().description('Name of your application'),
  PORT: Joi.number().default(8080).required(),
  MAIL_FROM: Joi.string().required().description('Email address to send emails from'),
  MAIL_HOST: Joi.string().required().description('Email host'),
  MAIL_PORT: Joi.number().required().description('Email port'),
  MAIL_USER: Joi.string().required().description('Email username'),
  MAIL_PASSWORD: Joi.string().required().description('Email password'),
  FRONTEND_APP_URL: Joi.string().required().description('Frontend url'),
  ENVIRONMENT: Joi.string().required().description('Environment'),
  JWT_ACCESS_TOKEN_EXPIRES: Joi.string().required().description('JWT access token expiration time'),
  JWT_REFRESH_TOKEN_EXPIRES: Joi.string().required().description('JWT refresh token expiration time'),
})

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  console.log(error.message);
  // throw new Error(`Config validation error ${error.message}`);
}

export default {
  env: envVars.NODE_ENV,
  DATABASE_URL: envVars.DATABASE_URL,
  appName: envVars.APP_NAME,
  port: envVars.PORT,
  from: envVars.MAIL_FROM,
  MAIL_HOST: envVars.MAIL_HOST, 
  MAIL_PORT: envVars.MAIL_PORT,
  MAIL_USER: envVars.MAIL_USER,
  MAIL_PASSWORD: envVars.MAIL_PASSWORD,
  FRONTEND_APP_URL: envVars.FRONTEND_APP_URL,
  ENVIRONMENT: envVars.ENVIRONMENT,
  jwtAccessTokenExpiration: envVars.JWT_ACCESS_TOKEN_EXPIRES,
  jwtRefreshTokenExpiration: envVars.JWT_REFRESH_TOKEN_EXPIRES,
}