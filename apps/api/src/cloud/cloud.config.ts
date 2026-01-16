export const CloudConfig = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    // Credentials will be loaded from environment or AWS credential chain
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  },
  polling: {
    intervalMinutes: 5, // Poll AWS every 5 minutes
  },
};