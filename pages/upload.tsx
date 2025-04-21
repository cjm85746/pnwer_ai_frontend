// pages/upload.tsx
import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://pnwer-ai-backend.onrender.com/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setStatus('✅ Upload successful!');
      } else {
        const error = await res.text();
        setStatus(`❌ Upload failed: ${error}`);
      }
    } catch (err) {
      setStatus(`❌ Upload error: ${err}`);
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">Upload a PDF</h1>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />
      <button onClick={handleUpload} className="px-4 py-2 bg-blue-600 text-white rounded">
        Upload
      </button>
      <p className="mt-4 text-gray-700">{status}</p>
    </div>
  );
}