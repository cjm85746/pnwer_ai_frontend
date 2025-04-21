import { useEffect, useState } from 'react';

export default function TrainedDataPage() {
  const [files, setFiles] = useState<{ filename: string; title?: string; uploadDate?: string }[]>([]);

  useEffect(() => {
    fetch('https://pnwer-ai-backend.onrender.com/list-files')
      .then((res) => res.json())
      .then((data) => setFiles(data.files))
      .catch((err) => console.error('Failed to fetch files:', err));
  }, []);

  const handleDelete = async (filename: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${filename}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`https://pnwer-ai-backend.onrender.com/delete-file/${filename}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((file) => file.filename !== filename));
      } else {
        alert('Failed to delete file.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-6">Uploaded PDF Files</h1>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            <th className="py-2 px-4">Title</th>
            <th className="py-2 px-4">Uploaded by</th>
            <th className="py-2 px-4">Upload Date</th>
            <th className="py-2 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.filename} className="border-b">
              <td className="py-2 px-4">{file.title || 'Text'}</td>
              <td className="py-2 px-4 text-blue-600">Jim Choi</td>
              <td className="py-2 px-4">{file.uploadDate}</td>
              <td className="py-2 px-4">
                <a
                  href={`https://pnwer-ai-backend.onrender.com/uploads/${file.filename}`}
                  className="text-blue-500 mr-4"
                  target="_blank"
                >
                  Open
                </a>
                <button
                  onClick={() => handleDelete(file.filename)}
                  className="text-red-500 hover:underline"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
