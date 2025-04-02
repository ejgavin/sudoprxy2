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
import { sendJson } from '@/utils/sending';
import { H3Event } from 'h3';

export default defineEventHandler(async (event) => {
  // handle CORS, if applicable
  if (isPreflightRequest(event)) return handleCors(event, {});

  // parse destination URL from the query
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

  // check if the request is allowed (token validation)
  if (!(await isAllowedToMakeRequest(event))) {
    return await sendJson({
      event,
      status: 401,
      data: {
        error: 'Invalid or missing token',
      },
    });
  }

  // read body
  const body = await getBodyBuffer(event);
  const token = await createTokenIfNeeded(event);

  // proxy the request and serve the content
  try {
    const fetchOptions = {
      method: event.method,
      headers: getProxyHeaders(event.headers),
      body,
    };

    // make a request to the destination (external resource)
    const response = await fetch(destination, fetchOptions);

    // handle response headers
    const headers = getAfterResponseHeaders(response.headers, destination);
    setResponseHeaders(event, headers);
    if (token) setTokenHeader(event, token);

    // generate iframe content with the response body
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

    // Send the response with embedded content
    return await sendJson({
      event,
      status: 200,
      data: {
        message: 'Content embedded successfully.',
        html: embedHTML,
      },
    });
  } catch (e) {
    console.log('Error fetching destination:', e);
    return await sendJson({
      event,
      status: 500,
      data: {
        error: 'Error fetching destination content.',
      },
    });
  }
});

