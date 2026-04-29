exports.handler = async (event) => {
  const { path, apiKey } = event.queryStringParameters || {};

  if (!apiKey || !path) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey or path' }) };
  }

  const url = `https://ronnoco.jotform.com/API/${path}?apiKey=${apiKey}`;
  console.log('POST to:', url.replace(apiKey, '[REDACTED]'));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: event.body,
    });
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
    console.error('POST error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
