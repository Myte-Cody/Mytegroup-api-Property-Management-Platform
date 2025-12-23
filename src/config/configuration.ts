export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const portFromEnv = process.env.APP_PORT;
  const envPort = portFromEnv
    ? parseInt(portFromEnv, 10)
    : parseInt((isProd ? process.env.PORT_PROD : process.env.PORT_DEV) || '3000', 10);

  const corsCsv = isProd ? process.env.CORS_ORIGINS_PROD : process.env.CORS_ORIGINS_DEV;

  return {
    nodeEnv,
    app: {
      port: envPort,
      baseUrl: process.env.APP_BASE_URL,
      clientBaseUrl: process.env.CLIENT_BASE_URL,
      corsOrigins: corsCsv || '',
    },
    db: {
      url: process.env.DB_URL,
      name: process.env.MONGO_DB_NAME,
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiration: process.env.JWT_EXPIRATION || '15m',
      refreshTtl: process.env.REFRESH_TOKEN_TTL || '30d',
      cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    },
    email: {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      useEthereal: process.env.EMAIL_USE_ETHEREAL === 'true',
    },
    sms: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_PHONE_NUMBER,
      enabled: process.env.TWILIO_ENABLED === 'true',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
  };
};
