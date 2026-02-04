import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sendPartnerInvite } from './functions/send-partner-invite/resource';
import { sendReportEmail } from './functions/send-report-email/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  sendPartnerInvite,
  sendReportEmail,
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

// Report emails use Resend API (no SES). Add RESEND_API_KEY env var:
// AWS Console → Lambda → send-report-email → Configuration → Environment variables
// Or: export RESEND_API_KEY=re_xxx before `npx ampx sandbox`
const sendReportEmailLambda = backend.sendReportEmail.resources.lambda;
sendReportEmailLambda.addEnvironment(
  'RESEND_API_KEY',
  process.env.RESEND_API_KEY ?? ''
);
