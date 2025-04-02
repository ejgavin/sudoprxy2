import {
  H3Event,
  ProxyOptions,
  getProxyRequestHeaders,
  RequestHeaders,
} from 'h3';

const PayloadMethods = new Set(['PATCH', 'POST', 'PUT', 'DELETE']);

// Merge headers function to combine multiple headers
function mergeHeaders(
  defaults: HeadersInit,
  ...inputs: (HeadersInit | RequestHeaders | undefined)[]
) {
  const _inputs = inputs.filter(Boolean) as HeadersInit[];
  if (_inputs.length === 0) {
    return defaults;
  }
  const merged = new Headers(defaults);
  for (const input of _inputs) {
    if (input.entries) {
      for (const [key, value] of (input.entries as any)()) {
        if (value !== undefined) {
          merged.set(key, value);
        }
      }
    } else {
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
          merged.set(key, value);
        }
      }
    }
  }
  return merged;
}

// Function to handle the proxy request
export async function specificProxyRequest(
  event: H3Event,
  target: string,
  opts: ProxyOptions = {},
) {
  let body;
  let duplex;
  if (PayloadMethods.has(event.method)) {
    if (opts.streamRequest) {
      body = getRequestWebStream(event);
      duplex = 'half';
    } else {
      body = await readRawBody(event, false).catch(() => undefined);
    }
  }

  const method = opts.fetchOptions?.method || event.method;
  const oldHeaders = getProxyRequestHeaders(event);

  // Temporary fix for encoding issues (e.g., netlify changing encoding headers)
  if (oldHeaders['accept-encoding']?.includes('zstd')) {
    oldHeaders['accept-encoding'] = oldHeaders['accept-encoding']
      .split(',')
      .map((x: string) => x.trim())
      .filter((x: string) => x !== 'zstd')
      .join(', ');
  }

  // Merge headers with any additional fetch options
  const fetchHeaders = mergeHeaders(
    oldHeaders,
    opts.fetchOptions?.headers,
    opts.headers,
  );

  const headerObj = Object.fromEntries([...(fetchHeaders.entries as any)()]);
  if (process.env.REQ_DEBUG === 'true') {
    console.log({
      type: 'request',
      method,
      url: target,
      headers: headerObj,
    });
  }

  // Send the actual request and proxy the response
  try {
    return await sendProxy(event, target, {
      ...opts,
      fetchOptions: {
        method,
        body,
        duplex,
        ...opts.fetchOptions,
        headers: fetchHeaders,
      },
    });
  } catch (error) {
    console.log('Error during proxy request:', error);
    throw new Error('Failed to proxy request');
  }
}

