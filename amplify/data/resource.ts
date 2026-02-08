import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { sendPartnerInvite } from '../functions/send-partner-invite/resource';
import { sendReportEmail as sendReportEmailFn } from '../functions/send-report-email/resource';
import { sendRoseEmail } from '../functions/send-rose-email/resource';
import { computeDiscoveryScores } from '../functions/compute-discovery-scores/resource';
import { frontendLogger } from '../functions/frontend-logger/resource';

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
      height: a.string(), // e.g. "5'10\"" or "5 ft 10 in"
      cohort: a.string(), // PGP1, PGP2, PGPX, PhD, AA, Staff, Other
      gender: a.string(),
      sexualOrientation: a.string(),
      intention: a.string(), // Date for Prom, Long Term, Not Sure
      hometown: a.string(),
      // Optional: may be null for existing users before flow-choice; app uses ?? or optional chaining
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
      
      // This or That polls: 5 IIMA + 5 general
      poll145Surprises: a.string(),        // IIMA: Love them | Hate them
      pollMaggiOrChai: a.string(),         // IIMA: Maggi | Chai / Coffee
      pollSectionOrBatch: a.string(),      // IIMA: Section party | Batch party
      pollDormOrLibrary: a.string(),       // IIMA: Dorm | Library
      pollNetflixOrGoingOut: a.string(),   // Stay in | Going out
      pollTextingOrCalling: a.string(),    // Texting | Calling
      pollSurpriseOrPlanned: a.string(),   // Surprise plans | Planned ahead
      pollDeepOrSilly: a.string(),         // Deep talks | Silly banter
      pollBoredInRoom: a.string(),         // Walk & Talk | Sit and vibe
      pollCasualOrDressed: a.string(),     // Casual outfit | Dressed up
      
      // Profile completion status (optional: may be null for existing users; app uses ?? or !== true)
      onboardingCompleted: a.boolean(),
      // When true, user is in a confirmed partner match and should not appear in discovery
      excludeFromDiscovery: a.boolean(),
      // Anonymous rose emails: max 2 per user (enforced in send-rose-email Lambda)
      rosesSentCount: a.integer(),
      // Discovery feed ranking: 0–1 score (email-name match, age sanity, popularity, completeness, recency). Updated by cron.
      discoveryScore: a.float(),
      lastDiscoveryScoreAt: a.datetime(),
      // Set when user last updated their profile; used for recency boost in discovery score
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),      // Allow API key for public access
      allow.authenticated(),      // Allow authenticated users to create/update their own profiles
    ]),

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

  /** Prom Ask: user A (fromUserId) asks match B (toUserId) to go to prom. Both are already matched. */
  PromAskRequest: a
    .model({
      fromUserId: a.string().required(),       // UserProfile id of requester
      toUserId: a.string().required(),         // UserProfile id of recipient (the match)
      matchId: a.string().required(),          // The Match id linking these two
      message: a.string(),                     // Optional personal message
      status: a.string().default("pending"),   // pending, accepted, declined
      createdAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index("toUserId"),                       // Find prom asks for me
      index("fromUserId"),                     // Find prom asks I sent
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
      allow.authenticated(),
    ]),

  /** Like: user A (fromUserId) liked user B (toUserId). UserProfile ids. */
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

  /** Report: user A (reporterUserId) reported user B (reportedProfileId). Used to exclude from discovery. */
  Report: a
    .model({
      reporterUserId: a.string().required(),
      reportedProfileId: a.string().required(),
      createdAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index("reporterUserId"),   // Query "profiles I have reported" for Discover exclusion
    ])
    .authorization((allow) => [allow.publicApiKey(), allow.authenticated()]),

  /** Match: mutual like between two users. user1Id/user2Id are UserProfile ids. */
  Match: a
    .model({
      user1Id: a.string().required(),           // First user's UserProfile id
      user2Id: a.string().required(),           // Second user's UserProfile id
      user1Email: a.string(),                   // First user's email (for display)
      user2Email: a.string(),                   // Second user's email (for display)
      status: a.string().default("active"),     // active, unmatched, blocked
      conversationId: a.string(),               // Link to conversation when created
      isPromDate: a.boolean(),                  // true = confirmed prom date, both out of discovery
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

  // Custom query to send report email (Lambda + SES)
  sendReportEmail: a
    .query()
    .arguments({
      personName: a.string(),
      personId: a.string(),
      context: a.string(),
      reportText: a.string().required(),
      reporterEmail: a.string(),
      reporterName: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated(), allow.publicApiKey()])
    .handler(a.handler.function(sendReportEmailFn)),

  // Anonymous rose email: send "someone wants to go to Prom with you" (max 2 per user; no sender stored)
  sendRoseEmail: a
    .query()
    .arguments({
      currentUserId: a.string().required(),
      toEmail: a.string().required(),
      appUrl: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated(), allow.publicApiKey()])
    .handler(a.handler.function(sendRoseEmail)),

  // Cron: compute discovery scores (email match, age sanity, popularity). Call manually or via EventBridge.
  computeDiscoveryScores: a
    .query()
    .returns(a.json())
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(computeDiscoveryScores)),

  // Custom mutation to receive frontend logs and write to CloudWatch (separate dev/prod streams)
  logFrontendEvent: a
    .mutation()
    .arguments({
      level: a.string().required(),
      message: a.string().required(),
      env: a.string().required(),
      component: a.string(),
      operation: a.string(),
      extra: a.json(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated(), allow.publicApiKey()])
    .handler(a.handler.function(frontendLogger)),

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
})
  .authorization((allow) => [allow.resource(sendRoseEmail), allow.resource(computeDiscoveryScores)]);

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
