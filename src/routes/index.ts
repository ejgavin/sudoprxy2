import { getBodyBuffer } from '@/utils/body';
import {
  getProxyHeaders,
  getAfterResponseHeaders,
  getBlacklistedHeaders,
} from '@/utils/headers';
import {
  createTokenIfNeeded,
  isAllowedToMakeRequest,
  setTokenHeader,
} from '@/utils/turnstile';
import { H3Event } from 'h3';
import { sendJson } from '@/utils/sending';

export default defineEventHandler(async (event) => {
  // Handle CORS if applicable
  if (isPreflightRequest(event)) return handleCors(event, {});

  // Parse the destination URL from the query
  const destination = getQuery<{ destination?: string }>(event).destination;
  if (!destination) {
    return await sendJson({
      event,
      status: 400,
      data: {
        error: 'Destination URL is required',
      },
    });
  }

  // Check if the request is allowed (Token validation)
  if (!(await isAllowedToMakeRequest(event))) {
    return await sendJson({
      event,
      status: 401,
      data: {
        error: 'Invalid or missing token',
      },
    });
  }

  // Read the body for any additional data if necessary
  const body = await getBodyBuffer(event);
  const token = await createTokenIfNeeded(event);

  // Create the embed HTML to display the destination content
  const embedHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Embedded Content</title>
      <style>
        body { margin: 0; padding: 0; }
        iframe { width: 100%; height: 100vh; border: none; }
      </style>
    </head>
    <body>
      <iframe src="${destination}" frameborder="0"></iframe>
    </body>
    </html>
  `;

  // Send the embedded HTML as a response
  return await sendJson({
    event,
    status: 200,
    data: {
      message: 'Embedding content from the destination URL.',
      html: embedHTML,
    },
  });
});

