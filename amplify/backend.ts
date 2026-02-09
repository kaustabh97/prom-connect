import { defineBackend } from '@aws-amplify/backend';
import { Duration } from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sendPartnerInvite } from './functions/send-partner-invite/resource';
import { sendReportEmail } from './functions/send-report-email/resource';
import { sendRoseEmail } from './functions/send-rose-email/resource';
import { computeDiscoveryScores } from './functions/compute-discovery-scores/resource';
import { ensureMutualMatches } from './functions/ensure-mutual-matches/resource';
import { frontendLogger } from './functions/frontend-logger/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  sendPartnerInvite,
  sendReportEmail,
  sendRoseEmail,
  computeDiscoveryScores,
  ensureMutualMatches,
  frontendLogger,
});

// Frontend logger: dedicated log group per branch (omit logGroupName so CDK generates
// unique names per stack, avoiding "already exists" conflicts when deploying dev + prod)
const frontendLogsStack = backend.createStack('FrontendLogs');
const frontendLogGroup = new logs.LogGroup(frontendLogsStack, 'FrontendLogGroup', {
  retention: logs.RetentionDays.THREE_MONTHS,
});
type LambdaWithEnv = {
  addEnvironment(key: string, value: string): void;
};
const frontendLoggerLambda = backend.frontendLogger.resources.lambda;
(frontendLoggerLambda as unknown as LambdaWithEnv).addEnvironment('FRONTEND_LOG_GROUP', frontendLogGroup.logGroupName);
frontendLoggerLambda.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'AllowCloudWatchLogsPut',
    actions: ['logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams'],
    resources: [frontendLogGroup.logGroupArn, `${frontendLogGroup.logGroupArn}:*`],
  })
);

// Grant SES send email permission for partner invite emails
const sendPartnerInviteLambda = backend.sendPartnerInvite.resources.lambda;
sendPartnerInviteLambda.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'AllowSesSendEmail',
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

// Grant SES send email permission for anonymous rose emails (from cultcomm@iima.ac.in)
const sendRoseEmailLambda = backend.sendRoseEmail.resources.lambda;
sendRoseEmailLambda.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'AllowSesSendEmail',
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);
// SES identities are per-region. Default ap-south-1 (Mumbai) where cultcomm@iima.ac.in is verified.
(sendRoseEmailLambda as unknown as LambdaWithEnv).addEnvironment('SES_REGION', process.env.SES_REGION ?? 'ap-south-1');
(sendRoseEmailLambda as unknown as LambdaWithEnv).addEnvironment('SES_FROM_EMAIL', process.env.SES_FROM_EMAIL ?? '');

// Report emails use Resend API (no SES). RESEND_API_KEY from env when running sandbox.
const sendReportEmailLambda = backend.sendReportEmail.resources.lambda as unknown as LambdaWithEnv;
sendReportEmailLambda.addEnvironment(
  'RESEND_API_KEY',
  process.env.RESEND_API_KEY ?? ''
);

// Discovery score: run on schedule (every 3 hours) and once on every deploy
const computeDiscoveryScoresLambda = backend.computeDiscoveryScores.resources.lambda;
const computeStack = backend.computeDiscoveryScores.resources.lambda.stack;

// Grant S3 read permission for model introspection schema
// The Lambda needs to read the schema from S3 to initialize the Amplify Data client
// Amplify creates buckets with pattern: amplify-{appId}-ma-modelintrospectionschema-{random}
// Since the exact bucket name is generated at deploy time, we grant access to all Amplify buckets
// This is safe as they're all Amplify-managed resources
computeDiscoveryScoresLambda.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'AllowS3ReadModelIntrospectionSchema',
    actions: ['s3:GetObject'],
    resources: [
      `arn:aws:s3:::amplify-*/*`,
    ],
  })
);

new events.Rule(computeStack, 'ComputeDiscoveryScoresSchedule', {
  schedule: events.Schedule.rate(Duration.hours(1)),
  targets: [new targets.LambdaFunction(computeDiscoveryScoresLambda)],
  description: 'Run discovery score computation every 1 hour',
});

// Invoke discovery score Lambda once on deploy (so DB has scores right after deploy, not only after first schedule run)
new cr.AwsCustomResource(computeStack, 'ComputeDiscoveryScoresOnDeploy', {
  onCreate: {
    service: 'Lambda',
    action: 'invoke',
    parameters: {
      FunctionName: computeDiscoveryScoresLambda.functionName,
      InvocationType: 'Event',
    },
    physicalResourceId: cr.PhysicalResourceId.of('ComputeDiscoveryScoresOnDeploy'),
  },
  onUpdate: {
    service: 'Lambda',
    action: 'invoke',
    parameters: {
      FunctionName: computeDiscoveryScoresLambda.functionName,
      InvocationType: 'Event',
    },
    physicalResourceId: cr.PhysicalResourceId.of('ComputeDiscoveryScoresOnDeploy'),
  },
  policy: cr.AwsCustomResourcePolicy.fromStatements([
    new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [computeDiscoveryScoresLambda.functionArn],
    }),
  ]),
});

// Ensure mutual likes are turned into Matches every hour (backfill safety net)
const ensureMutualMatchesLambda = backend.ensureMutualMatches.resources.lambda;
const ensureStack = ensureMutualMatchesLambda.stack;

// Grant S3 read permission for model introspection schema
ensureMutualMatchesLambda.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'AllowS3ReadModelIntrospectionSchema',
    actions: ['s3:GetObject'],
    resources: [
      `arn:aws:s3:::amplify-*/*`,
    ],
  })
);

new events.Rule(ensureStack, 'EnsureMutualMatchesSchedule', {
  schedule: events.Schedule.rate(Duration.hours(1)),
  targets: [new targets.LambdaFunction(ensureMutualMatchesLambda)],
  description: 'Ensure mutual likes become matches every hour',
});

