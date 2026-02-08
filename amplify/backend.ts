import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sendPartnerInvite } from './functions/send-partner-invite/resource';
import { sendReportEmail } from './functions/send-report-email/resource';
import { sendRoseEmail } from './functions/send-rose-email/resource';
import { frontendLogger } from './functions/frontend-logger/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  sendPartnerInvite,
  sendReportEmail,
  sendRoseEmail,
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

// Report emails use Resend API (no SES). RESEND_API_KEY from env when running sandbox.
const sendReportEmailLambda = backend.sendReportEmail.resources.lambda as unknown as LambdaWithEnv;
sendReportEmailLambda.addEnvironment(
  'RESEND_API_KEY',
  process.env.RESEND_API_KEY ?? ''
);
