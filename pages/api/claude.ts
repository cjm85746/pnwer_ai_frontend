import type { NextApiRequest, NextApiResponse } from 'next';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { messages, preprompt } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[Claude Error] Missing API key');
    return res.status(500).json({ reply: '[Missing API key]' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: preprompt || '',
        messages,
      }),
    });

    const data = await response.json();

    // ✅ Add Debug Logs
    console.log('[Claude Raw Response Status]', response.status);
    console.log('[Claude Raw Response JSON]', JSON.stringify(data, null, 2));

    if (data?.error) {
      console.error('[Claude API error]', data.error.message);
      return res.status(500).json({ reply: `[Claude Error] ${data.error.message}` });
    }

    return res.status(200).json({ reply: data?.content?.[0]?.text || '[No response]' });
  } catch (error) {
    console.error('[Claude API Error]', error);
    return res.status(500).json({ reply: '[Error connecting to Claude]' });
  }
};

export default handler;