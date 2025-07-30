"use client";
import React, { useState, useRef, useEffect, ReactElement } from 'react';
import mammoth from 'mammoth';
import { Send, Pause, Lock, FileText, Brain, User, Bot, Clock, Upload } from 'lucide-react';

// Type definitions
interface DialogueMessage {
  type: 'system' | 'user' | 'ai' | 'reflection' | 'analysis_request';
  content: string;
  timestamp?: string;
  prompt?: string;
}

interface ReflectionPrompt {
  type: 'reflection';
  prompt: string;
  content: string;
  timestamp: string;
}

interface SessionDuration {
  minutes: number;
  seconds: number;
}

interface SessionAnalysis {
  content: string;
  studentReflections: {
    contentLearning: string;
    processLearning: string;
  };
}

interface APIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function CoLearnInterface() {
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [sessionLocked, setSessionLocked] = useState<boolean>(false);
  const [sourceText, setSourceText] = useState<string>('');
  const [focusQuestion, setFocusQuestion] = useState<string>('');
  const [dialogue, setDialogue] = useState<DialogueMessage[]>([]);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [reflectionPrompts, setReflectionPrompts] = useState<ReflectionPrompt[]>([]);
  const [showReflectionModal, setShowReflectionModal] = useState<boolean>(false);
  const [currentReflection, setCurrentReflection] = useState<string>('');
  const [sessionAnalysis, setSessionAnalysis] = useState<SessionAnalysis | null>(null);
  const [exchangeCount, setExchangeCount] = useState<number>(0);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [showContinuePrompt, setShowContinuePrompt] = useState<boolean>(false);
  const [showEndReflection, setShowEndReflection] = useState<boolean>(false);
  const [endReflectionAnswers, setEndReflectionAnswers] = useState<string[]>(['', '']);
  const [generatedProcessQuestion, setGeneratedProcessQuestion] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState<SessionDuration | null>(null);
  const [reflectionInput, setReflectionInput] = useState<string>('');
  const [hiddenDocumentContent, setHiddenDocumentContent] = useState<string>('');
  const [documentUploaded, setDocumentUploaded] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [dialogue]);

  // Call our backend API
  const callAI = async (systemPrompt: string, messages: APIMessage[]): Promise<string> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, messages })
      });
      if (!response.ok) throw new Error(`API call failed: ${response.status}`);
      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('AI call error:', error);
      throw error;
    }
  };

  // Combine visible and hidden source material
  const getSourceMaterial = (): string => {
    const visibleText = sourceText.trim();
    const hiddenText = hiddenDocumentContent.trim();
    if (hiddenText && !visibleText.startsWith('✅') && !visibleText.startsWith('📄')) {
      return `UPLOADED DOCUMENT CONTENT:\n${hiddenText}\n\nADDITIONAL CONTEXT PROVIDED BY USER:\n${visibleText}`;
    } else if (hiddenText) {
      return hiddenText;
    } else {
      return visibleText;
    }
  };

  // Handle file uploads (PDF, Word, text)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setDocumentUploaded(true);
    setSourceText(`📄 Processing ${file.name}...`);

    try {
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      let extractedContent = '';
      const arrayBuffer = await file.arrayBuffer();

      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // PDF.js extraction (unchanged)
        if (!(window as any).pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
              (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
        }
        extractedContent = fullText.trim();

      } else if (fileType.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        // Use Mammoth.js in-browser for Word extraction
        const { value } = await mammoth.extractRawText({ arrayBuffer });
        extractedContent = value;

      } else if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        extractedContent = await file.text();
      } else {
        extractedContent = `[Document: ${file.name} - File type not supported for automatic extraction. Please copy and paste manually.]`;
      }

      // Store invisibly, but also show for debugging
      setHiddenDocumentContent(extractedContent);
      setSourceText(extractedContent);  // <--- Debug: display extracted text

    } catch (error) {
      console.error('Error processing file:', error);
      setHiddenDocumentContent('');
      setSourceText(`❌ Error processing ${file.name}. Please try again or paste content manually.`);
    }
  };

  const removeFile = (): void => {
    setUploadedFileName('');
    setHiddenDocumentContent('');
    setDocumentUploaded(false);
    setSourceText('');
  };

  // ... rest of your session logic (startSession, handleSendMessage, reflections, locking, analysis) remains unchanged ...

  return (
    <div>
      {/* INITIAL SETUP SCREEN */}
      {!sessionActive && (
        <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
          {/* Upload / Paste Area */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline w-4 h-4 mr-1" /> Source Material
            </label>
            <div className="flex items-center gap-4 mb-2">
              <label className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg border border-blue-200 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.docx,.doc,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="inline w-4 h-4 mr-1" /> Upload Document
              </label>
              <span className="text-gray-500 text-sm">or paste your material below</span>
            </div>
            {uploadedFileName && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-green-800 text-sm font-medium">{uploadedFileName}</span>
                </div>
                <button onClick={removeFile} className="text-green-600 hover:text-green-800 text-sm underline">
                  Remove
                </button>
              </div>
            )}
            {/* Inline fallback message if extraction blank */}
            {documentUploaded && !hiddenDocumentContent.trim() && (
              <p className="text-red-600 text-sm mt-2">
                We couldn’t extract any text from that Word file. Try saving it as a .docx or paste the content below.
              </p>
            )}
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste your text, article, notes..."
              className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
          {/* ... remaining UI ... */}
        </div>
      )}
      {/* ... rest of component UI ... */}
    </div>
  );
}
