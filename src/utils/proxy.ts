import { H3Event, ProxyOptions, getProxyRequestHeaders, sendProxy } from 'h3';

// Function to handle proxying requests for external resources (CSS/JS)
export async function handleExternalResource(
  event: H3Event,
  target: string,
  opts: ProxyOptions = {}
) {
  const fetchHeaders = new Headers(event.headers);

  // Ensure headers are set for proper content types (e.g., for CSS/JS)
  fetchHeaders.set('Accept', 'application/javascript, application/json, text/css, text/html, */*');
  fetchHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/93.0');
  
  const response = await fetch(target, {
    method: 'GET',
    headers: fetchHeaders,
  });

  // Handle responses properly, especially for CSS/JS resources
  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('text/css')) {
    // Handle CSS resources
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': 'text/css',
        'Cache-Control': 'max-age=31536000',  // Cache for 1 year
      },
    });
  } else if (contentType.includes('application/javascript')) {
    // Handle JavaScript resources
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'max-age=31536000',
      },
    });
  } else {
    // Default response for other content types
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  }
}

// Function to handle the main proxy request
export async function specificProxyRequest(
  event: H3Event,
  target: string,
  opts: ProxyOptions = {}
) {
  const method = opts.fetchOptions?.method || event.method;
  const oldHeaders = getProxyRequestHeaders(event);
  
  // Ensure headers are set for proper content types
  const fetchHeaders = new Headers(oldHeaders);
  fetchHeaders.set('Accept', 'application/json, text/html, */*');
  fetchHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/93.0');

  const response = await fetch(target, {
    method,
    headers: fetchHeaders,
  });

  const contentType = response.headers.get('Content-Type') || '';
  
  if (contentType.includes('text/html')) {
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } else {
    return handleExternalResource(event, target, opts);  // Use handleExternalResource for CSS/JS
  }
}

