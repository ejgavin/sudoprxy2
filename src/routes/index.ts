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
import { specificProxyRequest } from '@/utils/proxy';
import { H3Event } from 'h3';

export default defineEventHandler(async (event: H3Event) => {
  // Handle CORS for preflight requests
  if (isPreflightRequest(event)) return handleCors(event, {});

  // Get the destination URL from the query string
  const destination = getQuery<{ destination?: string }>(event).destination;
  if (!destination) {
    // Return a message if no destination URL is provided
    return await sendJson({
      event,
      status: 200,
      data: {
        message: 'Please provide a destination URL using the "destination" query parameter.',
      },
    });
  }

  // Log the destination for debugging purposes
  console.log('Received destination:', destination);

  // Check if the request is allowed (e.g., based on headers or tokens)
  if (!(await isAllowedToMakeRequest(event))) {
    return await sendJson({
      event,
      status: 401,
      data: {
        error: 'Invalid or missing token',
      },
    });
  }

  // Read body if needed (for POST, PUT, etc.)
  const body = await getBodyBuffer(event);
  const token = await createTokenIfNeeded(event);

  try {
    // Make the proxy request to the destination
    await specificProxyRequest(event, destination, {
      blacklistedHeaders: getBlacklistedHeaders(),
      fetchOptions: {
        method: event.method,
        body,
        headers: getProxyHeaders(event.headers),
      },
      onResponse(outputEvent, response) {
        // Modify response headers as needed
        const headers = getAfterResponseHeaders(response.headers, response.url);
        setResponseHeaders(outputEvent, headers);
        if (token) setTokenHeader(event, token);
      },
    });

    // Return a success response
    return await sendJson({
      event,
      status: 200,
      data: {
        message: 'Request to the destination was successful.',
      },
    });

  } catch (error) {
    // Catch and log any errors during the proxy request
    console.error('Error during proxy request:', error);
    return await sendJson({
      event,
      status: 500,
      data: {
        error: 'An error occurred while processing the request.',
      },
    });
  }
});

