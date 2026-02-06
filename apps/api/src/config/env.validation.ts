import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5433),
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
  JWT_EXPIRES_IN: Joi.string().default('8h'),

  // Licensing
  LICENSE_SIGNING_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'LICENSE_SIGNING_SECRET must be at least 32 characters',
    'any.required': 'LICENSE_SIGNING_SECRET is required',
  }),

  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3100),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:3100'),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // SNMP
  SNMP_MODE: Joi.string().valid('simulation', 'production').default('simulation'),

  // Data Mode - controls simulation services
  // 'demo' = generate fake events/alerts for demos
  // 'production' = only real data, no simulated events
  DATA_MODE: Joi.string().valid('demo', 'production').default('demo'),
});
