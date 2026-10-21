module.exports = {
  apps: [
    {
      name: 'buckduck-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'postgresql://neondb_owner:npg_uwgqFW46ryYb@ep-damp-term-b4kxob0n-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
        JWT_SECRET: 'buckduck_super_secure_jwt_secret_key_2026',
        FRONTEND_URL: 'http://localhost:3000',
      },
    },
    {
      name: 'buckduck-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BACKEND_URL: 'http://localhost:4000',
      },
    },
  ],
};
