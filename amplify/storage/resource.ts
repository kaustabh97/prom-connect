import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'userPhotos',
  access: (allow) => ({
    'profile-pics/{entity_id}/*': [
      allow.authenticated.to(['read']),
      allow.entity('identity').to(['read', 'write', 'delete']),
      // Allow guest (unauthenticated) write for test mode when GOOGLE_LOGIN_CHECK is false
      allow.guest.to(['read', 'write', 'delete']),
    ],
  }),
});
