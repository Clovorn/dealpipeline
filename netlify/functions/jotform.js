exports.handler = async (event) => {
  const { path, apiKey } = event.queryStringParameters || {};

  if (!apiKey || !path) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey or path' }) };
  }

  const url = `https://ronnoco.jotform.com/API/${path}?apiKey=${apiKey}&limit=100`;
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
