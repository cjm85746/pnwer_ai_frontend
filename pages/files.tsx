import { useEffect, useState } from 'react';

export default function FilesPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('https://pnwer-ai-backend.onrender.com/list-files');
        const data = await res.json();
        setFiles(data.files || []);
      } catch (err) {
        console.error('Failed to fetch files:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">📂 Uploaded Files</h1>

      {loading ? (
        <p>Loading files...</p>
      ) : files.length === 0 ? (
        <p className="text-gray-500">No files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file}
              className="p-4 bg-white border rounded shadow hover:shadow-md transition cursor-pointer text-black"
            >
              {file}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}