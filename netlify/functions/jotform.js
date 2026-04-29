exports.handler = async (event) => {
  const { path, apiKey, offset, limit } = event.queryStringParameters || {};

  if (!apiKey || !path) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey or path' }) };
  }

  const params = new URLSearchParams({ apiKey, limit: limit||'100' });
  if (offset) params.set('offset', offset);
  const url = `https://ronnoco.jotform.com/API/${path}?${params.toString()}`;
  console.log('Fetching:', url.replace(apiKey, '[REDACTED]'));

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Response code:', data.responseCode, 'Message:', data.message);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Fetch error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
