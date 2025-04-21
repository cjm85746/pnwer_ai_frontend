// pages/api/readfile.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { filename, question } = req.body;

  if (!process.env.NEXT_PUBLIC_API_URL) {
    return res.status(500).json({ error: 'Missing backend URL' });
  }

  try {
    const backendRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        query: question,
      }),
    });

    const data = await backendRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[ReadFile API Error]', err);
    return res.status(500).json({ error: 'Failed to fetch file data' });
  }
};

export default handler;