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

  useEffect(() => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL;
    console.log("🌐 Backend base URL:", baseURL);
  
    fetch(`${baseURL}/`)
      .then((res) => res.json())
      .then((data) => console.log("✅ Backend response:", data))
      .catch((err) => console.error("❌ Backend unreachable:", err));
  }, []);


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
  
    let isEnrichment = false;
  
    if (droppedFile) {
      const formData = new FormData();
      formData.append('file', droppedFile);
  
      const extension = droppedFile.name.split('.').pop()?.toLowerCase();
      let endpoint = 'upload-csv';
  
      if (extension === 'pdf') {
        endpoint = 'upload-pdf';
      } else if (shouldUpdate || extension === 'csv') {
        endpoint = 'update-attendee-list';
      }
  
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
            isEnrichment = true;
            const downloadUrl = `https://pnwer-ai-backend.onrender.com${response.download_url}`;
            const summaryText = `✅ Enrichment Complete — Updated: ${response.summary.updated}, Skipped: ${response.summary.skipped}, Errors: ${response.summary.errors}<br><br>📎 <a href="${downloadUrl}" style="color:#2563eb;text-decoration:underline;">Download CSV</a>`;
  
            newChats[currentChatIndex].messages.push({
              role: 'assistant',
              content: summaryText,
            });
  
            setChats([...newChats]);
            setLoading(false);
            setFilePreview(null);
            setDroppedFile(null);
            return;
          }
  
          if (endpoint === 'upload-csv' && response.status === 'success') {
          }
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
  
    if (isEnrichment) return; // ✅ Skip Claude if enrichment was triggered
  
    const userMsgCount = updatedMessages.filter((m) => m.role === 'user').length;
    const messagesForClaude = updatedMessages.map(({ role, content }) => ({ role, content }));
  
    let vectorChunks: string[] = [];
    try {
      const vectorRes = await fetch('https://pnwer-ai-backend.onrender.com/vector-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          filename: droppedFile?.name || '',
        }),
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
          preprompt: `You are PNWER AI, a helpful assistant for PNWER. Answer based on the provided context.`,
          context: vectorChunks.slice(0, 5).join('\n\n'),
          messages: messagesForClaude,
        }),
      });
  
      const data = await res.json();
      newChats[currentChatIndex].messages = [
        ...updatedMessages,
        { role: 'assistant', content: data.reply },
      ];
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
        if (words.length > 5) topic = words.slice(0, 5).join(' ') + '...';
  
        const renamedChats = [...newChats];
        renamedChats[currentChatIndex].title = topic;
        setChats(renamedChats);
      }
    } catch (err) {
      console.error('Claude API error:', err);
      newChats[currentChatIndex].messages.push({
        role: 'assistant',
        content: '[Error fetching reply]',
      });
      setChats([...newChats]);
      setLoading(false);
    }
  
    setFilePreview(null);
    setDroppedFile(null);
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
        console.log('✅ CSV Uploaded:', result);
      } catch (err) {
        console.error('CSV Upload error:', err);
      }
    }
  };

  const removeFile = () => {
    setFilePreview(null);
    setDroppedFile(null);
  };

  return (
    <div className="flex h-screen bg-white">
      <FileDropzone onDrop={handleFileDrop} />

      <div className="w-64 bg-gray-100 p-4 flex flex-col justify-between">
        <div>
        <Image
            src="/pnwer-logo.png"
            alt="PNWER Logo"
            width={128}
            height={40}
            className="w-32 mb-6"
          />
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-600 font-bold">Chats History</p>
            <button onClick={startNewChat}>
            <Image
                src="/icon-new-note.png"
                alt="New Chat"
                width={16}
                height={16}
                className="w-4 h-4"
              />
            </button>
          </div>
          <ul className="space-y-2">
            {chats.map((chat, i) => (
              <li
                key={i}
                className={`p-2 rounded cursor-pointer text-black truncate ${i === currentChatIndex ? 'bg-gray-200' : ''}`}
                onClick={() => setCurrentChatIndex(i)}
                title={chat.title}
              >
                {chat.title || 'New Chat'}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm mt-4 flex items-center gap-2">
        <Image
            src="/avatar.png"
            alt="User Avatar"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-black">Matt Morrison</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="p-6 overflow-y-auto flex-1 flex flex-col">
          {chats[currentChatIndex].messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const alignment = isUser ? 'self-end' : 'self-start';
            const bgColor = isUser ? 'bg-gray-100' : 'bg-white';
            const bubbleWidth = isUser ? 'max-w-[408px]' : 'max-w-[90%]';

            return (
              <div key={i} className={`${alignment} mb-3`}>
                <div className={`inline-block p-3 rounded-md text-black ${bubbleWidth} box-border ${bgColor}`}>
                  {msg.file && isUser && (
                    <div className="flex items-center mb-2 px-3 py-2 border border-gray-300 rounded-md bg-white">
                      <Image
                        src="/icon_attach.png"
                        alt="Attached File"
                        width={20}
                        height={20}
                        className="w-5 h-5 mr-2"
                        />
                      <span className="text-sm text-black truncate max-w-xs">{msg.file.name}</span>
                    </div>
                  )}
                  <div
                        className="whitespace-pre-line break-words"
                        dangerouslySetInnerHTML={{ __html: msg.content }}
                      />
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="self-start mb-3">
              <div className="inline-block p-3 rounded-md bg-white text-black animate-pulse max-w-[408px] box-border">
                PNWER AI is typing...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 relative">
          {filePreview && (
            <div className="flex items-center mb-2 px-4 py-2 bg-white rounded-md border border-gray-300 w-fit">
              <Image
                src="/icon_attach.png"
                alt="Attachment"
                width={20}
                height={20}
                className="w-5 h-5 mr-2"
              />
              <span className="text-sm text-black mr-2 truncate max-w-xs">{filePreview.name}</span>
              <button onClick={removeFile}>
              <Image
                  src="/icon_close.png"
                  alt="Remove"
                  width={16}
                  height={16}
                  className="w-4 h-4"
                />
              </button>
            </div>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Message PNWER AI"
            className="w-full border border-gray-400 rounded-full px-4 py-2 placeholder-gray-400 text-black bg-gray-100 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
