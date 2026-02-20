import * as Joi from 'joi';

export const itsmEnvValidationSchema = Joi.object({
  // Database
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().default('ems_admin'),
  DATABASE_PASSWORD: Joi.string().required().messages({
    'any.required': 'DATABASE_PASSWORD is required',
  }),
  DATABASE_NAME: Joi.string().default('ems_platform'),

  // Authentication
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),

  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3005),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:3100'),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // EMS Core Integration
  EMS_CORE_URL: Joi.string().default('http://api:3100/api/v1'),
  ITSM_MODULE_API_KEY: Joi.string().default(''),
});
