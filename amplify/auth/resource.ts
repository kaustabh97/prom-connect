import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
      },
      // IMPORTANT: OAuth requires these to be defined
      callbackUrls: [
        'http://localhost:8080/',
        'https://your-production-url.com/'
      ],
      logoutUrls: [
        'http://localhost:8080/',
        'https://your-production-url.com/'
      ],
    },
  },
});