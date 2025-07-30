/**
 * CoLearn: Human + AI, in dialogue
 * 
 * An educational platform for reflective learning conversations between students and AI.
 * Supports document upload, contextual reflection prompts, and learning analysis.
 * 
 * @description AI-powered educational dialogue platform
 * @author [Simon James Brookes]
 * @version 1.0.0
 * @created [29th July 2025]
 * @framework Next.js 15.4.4 with React + TypeScript
 * @styling Tailwind CSS
 * @ai_integration Anthropic Claude API (Claude 3.5 Sonnet)
 * 
 * Key Features:
 * - Document processing (PDF, Word, Text) with invisible content extraction
 * - Three-stage dialogic AI conversation system
 * - Automatic and manual reflection prompts
 * - Sophisticated learning analysis and export
 * - Session management with duration tracking
 * 
 * Educational Methodology:
 * - Dialogic and posthuman learning theory
 * - Cognitive partnership (not tutoring)
 * - Process-focused assessment
 * - Metacognitive awareness development
 * 
 * @license MIT
 * @repository [Your repository URL when deployed]
 */

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
  // --- State hooks ---
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

  // --- Scroll helper ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogue]);

  // --- AI API call ---
  const callAI = async (systemPrompt: string, messages: APIMessage[]): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, messages })
    });
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    const data = await response.json();
    return data.content;
  };

  // --- Combine visible & hidden material ---
  const getSourceMaterial = (): string => {
    const visible = sourceText.trim();
    const hidden = hiddenDocumentContent.trim();
    if (hidden && !visible.startsWith('✅') && !visible.startsWith('📄')) {
      return `UPLOADED DOCUMENT CONTENT:\n${hidden}\n\nADDITIONAL CONTEXT PROVIDED BY USER:\n${visible}`;
    } else if (hidden) {
      return hidden;
    }
    return visible;
  };

  // --- PDF.js loader ---
  const loadPDFJS = async (): Promise<void> => {
    if ((window as any).pdfjsLib) return;
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // --- File upload & extraction ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setDocumentUploaded(true);
    setSourceText(`📄 Processing ${file.name}...`);

    try {
      const buf = await file.arrayBuffer();
      const name = file.name.toLowerCase();
      let extracted = '';

      if (name.endsWith('.pdf')) {
        await loadPDFJS();
        const pdf = await (window as any).pdfjsLib.getDocument({ data: buf }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const txt = await page.getTextContent();
          extracted += txt.items.map((item: any) => item.str).join(' ') + '\n\n';
        }
      } else if (name.match(/\.docx?$/)) {
        const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
        extracted = value;
      } else if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
        extracted = new TextDecoder().decode(buf);
      } else {
        extracted = `[Document: ${file.name} - Unsupported for automatic extraction]`;
      }

      setHiddenDocumentContent(extracted);
      setSourceText(extracted); // debug: show the extracted text
    } catch (err) {
      console.error('File processing error:', err);
      setHiddenDocumentContent('');
      setSourceText(`❌ Error processing ${file.name}`);
    }
  };

  const removeFile = () => {
    setUploadedFileName('');
    setHiddenDocumentContent('');
    setDocumentUploaded(false);
    setSourceText('');
  };

  // --- Start the learning session ---
  const startSession = async () => {
    if ((!sourceText.trim() && !hiddenDocumentContent.trim()) || !focusQuestion.trim()) {
      alert('Please provide source material and your main question.');
      return;
    }
    setSessionActive(true);
    setSessionStartTime(new Date());
    setDialogue([
      {
        type: 'system',
        content: `CoLearn session started. Focus question: "${focusQuestion}"`,
      },
    ]);
    setExchangeCount(1);
    setIsProcessing(true);

    const systemPrompt = `**YOUR ROLE: COGNITIVE PARTNER IN LEARNING DIALOGUE**

**SOURCE MATERIAL:**
${getSourceMaterial()}

**FOCUS QUESTION:** "${focusQuestion}"

Exchange 1: Start building understanding.`;

    try {
      const aiResponse = await callAI(systemPrompt, [
        { role: 'user', content: focusQuestion },
      ]);
      setDialogue((d) => [
        ...d,
        { type: 'ai', content: aiResponse, timestamp: new Date().toLocaleString() },
      ]);
    } catch (err) {
      setDialogue((d) => [
        ...d,
        {
          type: 'system',
          content: 'Error: Unable to start dialogue. Please try again.',
        },
      ]);
    }

    setIsProcessing(false);
  };

  // --- Continue the dialogue ---
  const handleSendMessage = async () => {
    if (!currentInput.trim() || isProcessing || sessionLocked) return;

    const userMsg: DialogueMessage = {
      type: 'user',
      content: currentInput,
      timestamp: new Date().toLocaleString(),
    };
    setDialogue((d) => [...d, userMsg]);
    setCurrentInput('');
    setIsProcessing(true);
    setExchangeCount((c) => c + 1);

    const history: APIMessage[] = dialogue
      .filter((m) => m.type !== 'system')
      .map((m) => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    const stageLabel =
      exchangeCount <= 4 ? 'EARLY STAGE' : exchangeCount <= 8 ? 'MID STAGE' : 'LATER STAGE';

    const prompt = `**CONTINUING DIALOGUE (${stageLabel})**

User: ${currentInput}

Source: ${getSourceMaterial()}`;

    try {
      const aiResp = await callAI(prompt, [
        ...history,
        { role: 'user', content: currentInput },
      ]);
      setDialogue((d) => [
        ...d,
        { type: 'ai', content: aiResp, timestamp: new Date().toLocaleString() },
      ]);
    } catch {
      setDialogue((d) => [
        ...d,
        { type: 'system', content: 'Error: Unable to continue dialogue.' },
      ]);
    }

    setIsProcessing(false);
  };

  // --- End session and move to reflection ---
  const lockSession = () => {
    setSessionLocked(true);
    if (sessionStartTime) {
      const diff = Date.now() - sessionStartTime.getTime();
      setSessionDuration({
        minutes: Math.floor(diff / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    }
    setShowEndReflection(true);
  };

  // --- Submit end-of-session reflections & analysis ---
  const handleEndReflectionSubmit = async () => {
    setIsProcessing(true);

    // Build your analysis prompt here (omitted for brevity)
    const analysisPrompt = `...your full analysis prompt...`;

    try {
      const analysis = await callAI(analysisPrompt, [
        { role: 'user', content: analysisPrompt },
      ]);
      setSessionAnalysis({
        content: analysis,
        studentReflections: {
          contentLearning: endReflectionAnswers[0] || 'No reflection provided',
          processLearning: endReflectionAnswers[1] || 'No reflection provided',
        },
      });
    } catch {
      setSessionAnalysis({
        content: 'Error generating analysis.',
        studentReflections: {
          contentLearning: endReflectionAnswers[0] || 'No reflection provided',
          processLearning: endReflectionAnswers[1] || 'No reflection provided',
        },
      });
    }

    setShowEndReflection(false);
    setIsProcessing(false);
  };

  // --- Reset everything to start a new session ---
  const resetSession = () => {
    setSessionActive(false);
    setSessionLocked(false);
    setDialogue([]);
    setReflectionPrompts([]);
    setSessionAnalysis(null);
    setExchangeCount(0);
    setCurrentInput('');
    setSourceText('');
    setFocusQuestion('');
    setShowContinuePrompt(false);
    setShowEndReflection(false);
    setEndReflectionAnswers(['', '']);
    setSessionStartTime(null);
    setSessionDuration(null);
    setReflectionInput('');
    setHiddenDocumentContent('');
    setUploadedFileName('');
    setDocumentUploaded(false);
  };

  // --- Main render ---
  return (
    <div>
      {/* INITIAL SETUP SCREEN */}
      {!sessionActive && (
        <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
          {/* ... your original initial setup JSX ... */}
          <button onClick={startSession}>Begin Learning Dialogue</button>
        </div>
      )}

      {/* ACTIVE DIALOGUE, REFLECTION & ANALYSIS screens follow your original structure */}
      {/* ... */}
      <div ref={messagesEndRef} />
    </div>
  );
}
