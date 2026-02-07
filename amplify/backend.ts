import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sendPartnerInvite } from './functions/send-partner-invite/resource';
import { sendReportEmail } from './functions/send-report-email/resource';
import { frontendLogger } from './functions/frontend-logger/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  sendPartnerInvite,
  sendReportEmail,
  frontendLogger,
});

// Grant SES send email permission for partner invite emails
const sendPartnerInviteLambda = backend.sendPartnerInvite.resources.lambda;
sendPartnerInviteLambda.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'AllowSesSendEmail',
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

// Report emails use Resend API (no SES). RESEND_API_KEY from env when running sandbox.
type LambdaWithEnv = {
  addEnvironment(key: string, value: string): void;
};
const sendReportEmailLambda = backend.sendReportEmail.resources.lambda as unknown as LambdaWithEnv;
sendReportEmailLambda.addEnvironment(
  'RESEND_API_KEY',
  process.env.RESEND_API_KEY ?? ''
);
