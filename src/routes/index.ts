import { getBodyBuffer } from '@/utils/body';
import { getProxyHeaders, getAfterResponseHeaders, getBlacklistedHeaders } from '@/utils/headers';
import { createTokenIfNeeded, isAllowedToMakeRequest, setTokenHeader } from '@/utils/turnstile';
import { specificProxyRequest, handleExternalResource } from '@/utils/proxy';

export default defineEventHandler(async (event) => {
  // handle CORS, if applicable
  if (isPreflightRequest(event)) return handleCors(event, {});

  // parse destination URL
  const destination = getQuery<{ destination?: string }>(event).destination;
  if (!destination)
    return await sendJson({
      event,
      status: 200,
      data: {
        message: `Proxy is working as expected (v${useRuntimeConfig(event).version})`,
      },
    });

  if (!(await isAllowedToMakeRequest(event)))
    return await sendJson({
      event,
      status: 401,
      data: {
        error: 'Invalid or missing token',
      },
    });

  // Read body
  const body = await getBodyBuffer(event);
  const token = await createTokenIfNeeded(event);

  // Route for external resources like CSS or JS
  if (destination.endsWith('.css') || destination.endsWith('.js')) {
    return await handleExternalResource(event, destination);
  }

  // Proxy the main content (iframe embedding)
  try {
    await specificProxyRequest(event, destination, {
      blacklistedHeaders: getBlacklistedHeaders(),
      fetchOptions: {
        redirect: 'follow',
        headers: getProxyHeaders(event.headers),
        body,
      },
      onResponse(outputEvent, response) {
        const headers = getAfterResponseHeaders(response.headers, response.url);
        setResponseHeaders(outputEvent, headers);
        if (token) setTokenHeader(event, token);
      },
    });
  } catch (e) {
    console.log('Error fetching', e);
    throw e;
  }
});

