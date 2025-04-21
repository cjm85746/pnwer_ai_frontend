import { useState, useRef, useEffect } from 'react';
import FileDropzone from '../components/FileDropzone';
import Image from 'next/image';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  file?: {
    name: string;
  };
};

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [filePreview, setFilePreview] = useState<{ name: string } | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [csvSummaryText, setCsvSummaryText] = useState<string | null>(null);

  const [chats, setChats] = useState<{
    title: string;
    messages: ChatMessage[];
  }[]>([
    {
      title: 'New Chat',
      messages: [
        {
          role: 'assistant',
          content: `Hi there! I'm PNWER AI — your internal guide for all things related to PNWER. Whether you're prepping for the event, exploring contacts, or need context on key topics, I'm here to help. Just let me know what you're working on!`,
        },
      ],
    },
  ]);

  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const shouldUpdate =
      /update.*(attendee|list)|enrich.*(attendee|list)/i.test(input) &&
      droppedFile?.name.endsWith('.csv');

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      ...(droppedFile && { file: { name: droppedFile.name } }),
    };

    const updatedMessages = [...chats[currentChatIndex].messages, userMessage];
    const newChats = [...chats];
    newChats[currentChatIndex].messages = updatedMessages;
    setChats(newChats);
    setInput('');
    setLoading(true);

    if (droppedFile) {
      const formData = new FormData();
      formData.append('file', droppedFile);

      const extension = droppedFile.name.split('.').pop()?.toLowerCase();
      let endpoint = extension === 'pdf' ? 'upload-pdf' : 'upload-csv';
      if (shouldUpdate) endpoint = 'update-attendee-list';

      try {
        const uploadRes = await fetch(`https://pnwer-ai-backend.onrender.com/${endpoint}`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          console.error('❌ Upload failed:', await uploadRes.text());
        } else {
          const response = await uploadRes.json();
          console.log('✅ File uploaded:', response);

          if (endpoint === 'update-attendee-list') {
            const downloadUrl = `https://pnwer-ai-backend.onrender.com${response.download_url}`;
            const summaryText = `✅ Enrichment Complete — Updated: ${response.summary.updated}, Skipped: ${response.summary.skipped}, Errors: ${response.summary.errors}<br><br>📎 <a href="${downloadUrl}" style="color:#2563eb;text-decoration:underline;">Download CSV</a>`;

            newChats[currentChatIndex].messages.push({ role: 'assistant', content: summaryText });
            setChats([...newChats]);
            setLoading(false);
            setFilePreview(null);
            setDroppedFile(null);
            return;
          }

          if (endpoint === 'upload-csv') {
            const summary = `Filename: ${response.filename}\nColumns: ${response.columns.join(', ')}\nPreview:\n${JSON.stringify(response.preview, null, 2)}`;
            setCsvSummaryText(summary);
          }
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    const userMsgCount = updatedMessages.filter((m) => m.role === 'user').length;
    const messagesForClaude = updatedMessages.map(({ role, content }) => ({ role, content }));

    let vectorChunks: string[] = [];
    try {
      const vectorRes = await fetch('https://pnwer-ai-backend.onrender.com/vector-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      });
      if (vectorRes.ok) {
        const vectorData = await vectorRes.json();
        vectorChunks = vectorData.chunks || [];
        console.log('🧠 Vector chunks returned:', vectorChunks);
      }
    } catch (err) {
      console.error('Vector search failed:', err);
    }

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preprompt: csvSummaryText
            ? `Here is a dataset uploaded by the user:\n\n${csvSummaryText}\n\nAnswer the following question using this data.`
            : `You are PNWER AI, a helpful assistant for PNWER. The user is asking a question based on information from past annual reports. Use the following relevant excerpts to inform your response:\n\n${vectorChunks.slice(0, 5).join('\n\n')}\n\n---END OF EXCERPTS---\nOnly answer based on these excerpts. If you don’t see the info, say so.`,
          messages: messagesForClaude,
        }),
      });
      const data = await res.json();
      newChats[currentChatIndex].messages = [...updatedMessages, { role: 'assistant', content: data.reply }];
      setChats([...newChats]);
      setLoading(false);

      if (userMsgCount === 1) {
        const topicRes = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preprompt: 'Summarize the user’s first question into a session topic in 5 words maximum, 1 line. If more than 5 words, end with "...".',
            messages: [{ role: 'user', content: input }],
          }),
        });
        const topicData = await topicRes.json();
        let topic = topicData.reply?.replace(/['"\n]/g, '') || '';
        const words = topic.split(/\s+/);
        if (words.length > 5) {
          topic = words.slice(0, 5).join(' ') + '...';
        }
        const renamedChats = [...newChats];
        renamedChats[currentChatIndex].title = topic;
        setChats(renamedChats);
      }
    } catch (err) {
      console.error('Claude API error:', err);
      newChats[currentChatIndex].messages.push({ role: 'assistant', content: '[Error fetching reply]' });
      setChats([...newChats]);
      setLoading(false);
    }

    setFilePreview(null);
    setDroppedFile(null);
    setCsvSummaryText(null);
  };

  const startNewChat = () => {
    setChats([
      ...chats,
      {
        title: '',
        messages: [
          {
            role: 'assistant',
            content: `Hi there! I'm PNWER AI — your internal guide for all things related to PNWER. Whether you're prepping for the event, exploring contacts, or need context on key topics, I'm here to help. Just let me know what you're working on!`,
          },
        ],
      },
    ]);
    setCurrentChatIndex(chats.length);
  };

  const handleFileDrop = async (file: File) => {
    setDroppedFile(file);
    setFilePreview({ name: file.name });

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const uploadRes = await fetch('https://pnwer-ai-backend.onrender.com/upload-csv', {
          method: 'POST',
          body: formData,
        });
        const result = await uploadRes.json();
        const columns = Array.isArray(result.columns) ? result.columns.join(', ') : '(No columns found)';
        const preview = result.preview ? JSON.stringify(result.preview, null, 2) : '(No preview available)';
        const textSummary = `Filename: ${result.filename}\nColumns: ${columns}\nPreview:\n${preview}`;
        setCsvSummaryText(textSummary);
        console.log('✅ CSV Uploaded:', result);
      } catch (err) {
        console.error('CSV Upload error:', err);
      }
    }
  };

  const removeFile = () => {
    setFilePreview(null);
    setDroppedFile(null);
    setCsvSummaryText(null);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <FileDropzone onDrop={handleFileDrop} />
      {/* ... UI code remains unchanged ... */}
    </div>
  );
}