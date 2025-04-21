import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB max
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[Upload Error]', err);
      return res.status(500).json({ error: 'Upload failed' });
    }

    const file = files.file?.[0] || files.file;
    const topic = fields.topic?.[0] || fields.topic || 'general';

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const displayName = Array.isArray(file) ? file[0]?.originalFilename : file.originalFilename;
    const storedName = path.basename(Array.isArray(file) ? file[0]?.filepath : file.filepath);

    // ✅ Save metadata
    const metadataPath = path.join(uploadDir, 'trained.json');
    const entry = {
      name: displayName,
      storedAs: storedName,
      uploadedAt: new Date().toISOString(),
      topic,
    };

    try {
      const existing = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        : [];
      existing.push(entry);
      fs.writeFileSync(metadataPath, JSON.stringify(existing, null, 2));
    } catch (err) {
      console.error('[Metadata Error]', err);
    }

    return res.status(200).json({
      success: true,
      file: {
        name: displayName,
        storedAs: storedName,
        topic,
      },
    });
  });
}