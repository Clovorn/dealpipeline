exports.handler = async (event) => {
  const { path, apiKey, ...rest } = event.queryStringParameters || {};

  if (!apiKey || !path) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey or path' }) };
  }

  const isPost = event.httpMethod === 'POST';
  const extraParams = new URLSearchParams(rest).toString();
  const sep = extraParams ? '&' : '';
  const url = `https://ronnoco.jotform.com/API/${path}?apiKey=${apiKey}${sep}${extraParams}`;

  try {
    const fetchOpts = isPost
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: event.body,
        }
      : { method: 'GET' };

    const response = await fetch(url, fetchOpts);
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
