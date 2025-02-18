import "server-only";

import { SITE_DOMAIN, SITE_URL } from "@/constants";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { render } from '@react-email/render'
import { ResetPasswordEmail } from "@/react-email/reset-password";
import { VerifyEmail } from "@/react-email/verify-email";
import isProd from "./isProd";

interface BrevoEmailOptions {
  to: { email: string; name?: string }[];
  subject: string;
  replyTo?: string;
  htmlContent: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, string>;
  tags?: string[];
}

interface ResendEmailOptions {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

type EmailProvider = "resend" | "brevo" | null;

async function getEmailProvider(): Promise<EmailProvider> {
  const { env } = await getCloudflareContext();

  if (env.RESEND_API_KEY) {
    return "resend";
  }

  if (env.BREVO_API_KEY) {
    return "brevo";
  }

  return null;
}

async function sendResendEmail({
  to,
  subject,
  html,
  from,
  replyTo: originalReplyTo,
  text,
  tags,
}: ResendEmailOptions) {
  if (!isProd) {
    return;
  }

  const { env } = await getCloudflareContext();

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const replyTo = originalReplyTo ?? env.EMAIL_REPLY_TO;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    } as const,
    body: JSON.stringify({
      from: from ?? `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text,
      reply_to: replyTo,
      tags,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to send email via Resend: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function sendBrevoEmail({
  to,
  subject,
  replyTo: originalReplyTo,
  htmlContent,
  textContent,
  templateId,
  params,
  tags,
}: BrevoEmailOptions) {
  if (!isProd) {
    return;
  }

  const { env } = await getCloudflareContext();

  if (!env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not set");
  }

  const replyTo = originalReplyTo ?? env.EMAIL_REPLY_TO;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": env.BREVO_API_KEY,
    } as const,
    body: JSON.stringify({
      sender: {
        name: env.EMAIL_FROM_NAME,
        email: env.EMAIL_FROM,
      },
      to,
      htmlContent,
      textContent,
      subject,
      templateId,
      params,
      tags,
      replyTo,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to send email via Brevo: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function sendPasswordResetEmail({
  email,
  resetToken,
  username
}: {
  email: string;
  resetToken: string;
  username: string;
}) {
  const resetUrl = `${SITE_URL}/reset-password?token=${resetToken}`;

  if (!isProd) {
    console.warn('\n\n\nPassword reset url: ', resetUrl)

    return
  }

  const html = await render(ResetPasswordEmail({ resetLink: resetUrl, username }));
  const provider = await getEmailProvider();

  if (!provider && isProd) {
    throw new Error("No email provider configured. Set either RESEND_API_KEY or BREVO_API_KEY in your environment.");
  }

  if (provider === "resend") {
    await sendResendEmail({
      to: [email],
      subject: `Reset your password for ${SITE_DOMAIN}`,
      html,
      tags: [{ name: "type", value: "password-reset" }],
    });
  } else {
    await sendBrevoEmail({
      to: [{ email, name: username }],
      subject: `Reset your password for ${SITE_DOMAIN}`,
      htmlContent: html,
      tags: ["password-reset"],
    });
  }
}

export async function sendVerificationEmail({
  email,
  verificationToken,
  username
}: {
  email: string;
  verificationToken: string;
  username: string;
}) {
  const verificationUrl = `${SITE_URL}/verify-email?token=${verificationToken}`;

  if (!isProd) {
    console.warn('\n\n\nVerification url: ', verificationUrl)

    return
  }

  const html = await render(VerifyEmail({ verificationLink: verificationUrl, username }));
  const provider = await getEmailProvider();

  if (!provider && isProd) {
    throw new Error("No email provider configured. Set either RESEND_API_KEY or BREVO_API_KEY in your environment.");
  }

  if (provider === "resend") {
    await sendResendEmail({
      to: [email],
      subject: `Verify your email for ${SITE_DOMAIN}`,
      html,
      tags: [{ name: "type", value: "email-verification" }],
    });
  } else {
    await sendBrevoEmail({
      to: [{ email, name: username }],
      subject: `Verify your email for ${SITE_DOMAIN}`,
      htmlContent: html,
      tags: ["email-verification"],
    });
  }
}
