import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client({ region: "eu-central-1", maxAttempts: 2 });
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!)
  );

// Delivery errors must propagate; the shared notification helper swallows them.
export async function sendSecurityEmail({
  email,
  title,
  subject,
  body,
  url,
  actionButtonText = "paperlesspaper",
}: {
  email: string;
  title: string;
  subject: string;
  body: string;
  url: string;
  actionButtonText?: string;
}) {
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: "paperlesspaper <notifications@wirewire.de>",
      Destination: { ToAddresses: [email] },
      ConfigurationSetName: "memo-transactional",
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: {
              Data: `${title}\n\n${body}\n\n${actionButtonText}: ${url}`,
              Charset: "UTF-8",
            },
            Html: {
              Data: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222"><div style="max-width:560px;margin:auto;padding:32px"><p>paperlesspaper</p><h1 style="font-size:24px">${escape(
                title
              )}</h1><p>${escape(body).replace(
                /\n/g,
                "<br>"
              )}</p><p><a href="${escape(url)}">${escape(
                actionButtonText
              )}</a></p></div></body></html>`,
              Charset: "UTF-8",
            },
          },
        },
      },
    }),
    { abortSignal: AbortSignal.timeout(20_000) }
  );
}
