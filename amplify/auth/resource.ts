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
      // NOTE: Add your local network IP for mobile testing (e.g., http://10.6.16.243:8080)
      callbackUrls: [
        'http://localhost:8080/onboarding',
        'http://localhost:8080/auth',
        'https://main.d1emd9gkgd3wf8.amplifyapp.com/onboarding',
        'https://f7c7f16199412ce0f064.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse'
      ],
      logoutUrls: [
        'http://localhost:8080/',
        'http://localhost:8080/auth',
        'https://main.d1emd9gkgd3wf8.amplifyapp.com'
      ],
    },
  },
});