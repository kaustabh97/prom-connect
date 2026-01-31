import { type ClientSchema, a, defineData, defineStorage } from '@aws-amplify/backend';

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any unauthenticated user can "create", "read", "update", 
and "delete" any "Todo" records.
=========================================================================*/

const schema = a.schema({
  UserProfile: a
    .model({
      // Basic info
      email: a.string().required(),
      name: a.string(),
      mobileNo: a.string(),
      age: a.integer(),
      gender: a.string(),
      sexualOrientation: a.string(),
      bio: a.string(),
      profilePicKey: a.string(), // Reference to the file in S3
      
      // Interests/tags
      tags: a.string().array(),
      
      // Lifestyle preferences
      alcoholPreference: a.string(),
      smokingPreference: a.string(),
      foodPreference: a.string(),
      favouritePlace: a.string(),
      teaOrCoffee: a.string(),
      mountainOrBeach: a.string(),
      
      // Profile completion status
      onboardingCompleted: a.boolean(),
    })
    .authorization((allow) => [
      // Allow public access via API key (for development)
      allow.publicApiKey(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

export const storage = defineStorage({
  name: 'userPhotos',
  access: (allow) => ({
    'profile-pics/{entity_id}/*': [
      allow.authenticated.to(['read']),
      allow.entity('identity').to(['read', 'write', 'delete'])
    ]
  })
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
