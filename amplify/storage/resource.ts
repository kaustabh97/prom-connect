import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'userPhotos',
  access: (allow) => ({
    'profile-pics/{entity_id}/*': [
      allow.authenticated.to(['read']),
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
});
