import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email' 
        }
      },
      // IMPORTANT: OAuth requires these to be defined
      // These are the URLs Cognito will redirect to AFTER Google OAuth completes
      callbackUrls: [
        'http://localhost:8080/onboarding',
        'https://your-production-url.com/',
        'https://f7c7f16199412ce0f064.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse'
      ],
      logoutUrls: [
        'http://localhost:8080/',
        'http://localhost:8080/auth',
        'https://your-production-url.com/'
      ],
    },
  },
});