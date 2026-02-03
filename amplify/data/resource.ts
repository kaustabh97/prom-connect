import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { sendPartnerInvite } from '../functions/send-partner-invite/resource';

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
      userId: a.string(), // Cognito/sub or test ID - for linking partners and match creation
      email: a.string().required(),
      name: a.string(),
      mobileNo: a.string(),
      dateOfBirth: a.string(), // DD MM YYYY format
      age: a.integer(), // Can be calculated from dateOfBirth
      cohort: a.string(), // PGP1, PGP2, PGPX, PhD, AA, Staff, Other
      gender: a.string(),
      sexualOrientation: a.string(),
      intention: a.string(), // Date for Prom, Long Term, Not Sure
      hometown: a.string(),
      partnerStatus: a.string(), // Looking for partner, Already have partner
      partnerEmail: a.string(), // Partner's IIMA email when both have partners; for direct matching
      bio: a.string(),
      profilePicKey: a.string(), // Reference to the file in S3
      notificationsEnabled: a.boolean(), // Browser and email notifications
      
      // Interests/tags
      tags: a.string().array(),
      
      // Lifestyle preferences (non-negotiables)
      alcoholPreference: a.string(),
      smokingPreference: a.string(),
      foodPreference: a.string(),
      favouritePlace: a.string(),
      teaOrCoffee: a.string(),
      mountainOrBeach: a.string(),
      
      // Optional fun questions (added after onboarding)
      morningOrNightPerson: a.string(),
      idealWeekend: a.string(),
      goToKaraokeSong: a.string(),
      superpowerChoice: a.string(),
      favouriteMovieGenre: a.string(),
      secretTalent: a.string(),
      // IIMA-specific & Indian college prom fun questions
      favouriteChaiSpot: a.string(),       // Tea Post, Nestlé, Room chai, LKP, etc.
      idealPromOutfit: a.string(),         // Saree/Kurta, Western, Fusion, Sherwani
      messOrOutside: a.string(),           // Mess loyalist, Outside foodie, Depends
      bestDateSpotOnCampus: a.string(),    // Tea Post, Heritage walk, Library, LKP
      bollywoodOrEnglishAtProm: a.string(),// Bollywood, English, Both
      lateNightRitual: a.string(),         // Maggi run, 2am chai, Dorm talks, etc.
      perfectSaturdayAtIIMA: a.string(),   // Free text
      goToBollywoodSong: a.string(),       // For karaoke / prom dance
      
      // Optional This or That polls (IIMA-specific)
      pollTniteOrStayIn: a.string(),       // Tnite | Stay in
      poll145Surprises: a.string(),        // Love them | Avoid them
      pollTeaPostOrNestle: a.string(),     // Tea Post | Nestlé
      pollMaggiOrChai: a.string(),         // Maggi | Chai
      pollDormOrLibrary: a.string(),       // Dorm | Library
      pollSectionOrBatch: a.string(),      // Section party | Batch party
      pollLKPOrHeritage: a.string(),       // LKP | Heritage walk
      pollMorningOrAfternoon: a.string(),  // Morning class | Afternoon class
      pollCROrLKP: a.string(),             // CR | LKP (weekend)
      
      // Profile completion status
      onboardingCompleted: a.boolean(),
      // When true, user is in a confirmed partner match and should not appear in discovery
      excludeFromDiscovery: a.boolean(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),      // Allow API key for public access
      allow.authenticated(),      // Allow authenticated users to create/update their own profiles
    ]),

<<<<<<< HEAD
  /** Partner link request: user A requests to link with partner B (by email). B must accept. */
  MatchRequest: a
    .model({
      fromUserId: a.string().required(),    // User who sent the request
      fromEmail: a.string().required(),     // For display
      fromName: a.string(),                 // Sender's name for display
      toEmail: a.string().required(),       // Partner's email (may not have profile yet)
      toUserId: a.string(),                 // Set when partner has profile
      status: a.string().default("pending"), // pending, accepted, declined
      createdAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index("toEmail"),                     // Find requests for partner when they sign up
      index("toUserId"),                    // Find requests for partner by their userId
      index("fromUserId"),                  // Find requests sent by user
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
      allow.authenticated(),
    ]),

  /** Like: user A liked user B */
=======
  /** Like: user A (fromUserId) liked user B (toUserId). UserProfile ids. */
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)
  Like: a
    .model({
      fromUserId: a.string().required(),
      toUserId: a.string().required(),
    })
    .secondaryIndexes((index) => [
      index("fromUserId"),   // Query "who I liked" for Discover exclusion
      index("toUserId"),     // Query "who liked me" for mutual match check
    ])
    .authorization((allow) => [allow.publicApiKey()]),

  /** Match: mutual like between two users. user1Id/user2Id are UserProfile ids. */
  Match: a
    .model({
      user1Id: a.string().required(),           // First user's UserProfile id
      user2Id: a.string().required(),           // Second user's UserProfile id
      user1Email: a.string(),                   // First user's email (for display)
      user2Email: a.string(),                   // Second user's email (for display)
      compatScore: a.float(),                   // Compatibility score (0-1)
      status: a.string().default("active"),     // active, unmatched, blocked
      conversationId: a.string(),               // Link to conversation when created
      createdAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index("user1Id"),                         // Query matches where user is user1
      index("user2Id"),                         // Query matches where user is user2
    ])
    .authorization((allow) => [
      allow.publicApiKey(),                     // TEMP: for development
      allow.authenticated(),                    // Production: authenticated users
    ]),

  // Chat functionality - Conversation between two matched users
  Conversation: a
    .model({
      user1Id: a.string().required(),           // First participant's user ID
      user2Id: a.string().required(),           // Second participant's user ID
      user1Revealed: a.boolean().default(false), // Has user1 revealed their identity?
      user2Revealed: a.boolean().default(false), // Has user2 revealed their identity?
      lastMessageAt: a.datetime(),              // For sorting conversations by recent activity
      matchId: a.string(),                      // Optional: link to match record
    })
    .secondaryIndexes((index) => [
      index("user1Id"),                         // Query conversations where user is user1
      index("user2Id"),                         // Query conversations where user is user2
    ])
    .authorization((allow) => [
      allow.publicApiKey(),                     // Allow public access for development (TEMP)
      allow.authenticated(),                    // Authenticated users can access
    ]),

  // Custom query to send partner invite email (Lambda + SES)
  sendPartnerInviteEmail: a
    .query()
    .arguments({
      toEmail: a.string(),
      fromName: a.string(),
      appUrl: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated(), allow.publicApiKey()])
    .handler(a.handler.function(sendPartnerInvite)),

  // Individual messages within a conversation
  Message: a
    .model({
      conversationId: a.string().required(),    // Links to Conversation
      senderId: a.string().required(),          // User ID of the sender
      content: a.string().required(),           // Message text content
      sentAt: a.datetime().required(),          // Timestamp when message was sent
    })
    .secondaryIndexes((index) => [
      index("conversationId").sortKeys(["sentAt"]), // Query messages by conversation, sorted by time
    ])
    .authorization((allow) => [
      allow.publicApiKey(),                     // Allow public access for development (TEMP)
      allow.authenticated(),                    // Authenticated users can access
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
