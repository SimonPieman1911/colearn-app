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
 * @license [Your chosen license - e.g., MIT, GPL, proprietary]
 * @repository [Your repository URL when deployed]
 */

'use client';

import React, { useState, useRef, useEffect, ReactElement } from 'react';
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
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
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
        body: JSON.stringify({
          systemPrompt: systemPrompt,
          messages: messages
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('AI call error:', error);
      throw error;
    }
  };

  // Get source material for AI (combines visible text and hidden document content)
  const getSourceMaterial = (): string => {
    const visibleText = sourceText.trim();
    const hiddenText = hiddenDocumentContent.trim();
    
    // Debug logging
    console.log('getSourceMaterial called:');
    console.log('- visibleText length:', visibleText.length);
    console.log('- hiddenText length:', hiddenText.length);
    console.log('- visibleText starts with:', visibleText.substring(0, 50));
    console.log('- hiddenText starts with:', hiddenText.substring(0, 50));
    
    if (hiddenText && !visibleText.startsWith('✅') && !visibleText.startsWith('📄')) {
      // Both document upload and pasted text
      return `UPLOADED DOCUMENT CONTENT:\n${hiddenText}\n\nADDITIONAL CONTEXT PROVIDED BY USER:\n${visibleText}`;
    } else if (hiddenText) {
      // Only document upload
      return hiddenText;
    } else {
      // Only pasted text
      return visibleText;
    }
  };

  // Load PDF.js library dynamically
  const loadPDFJS = async (): Promise<void> => {
    if ((window as any).pdfjsLib) return;
    
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Load Mammoth.js library dynamically for Word documents
  const loadMammoth = async (): Promise<void> => {
    if ((window as any).mammoth) return;
    
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js';
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setDocumentUploaded(true);
    
    // Show processing status to user
    setSourceText(`📄 Processing ${file.name}...`);
    
    try {
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      let extractedContent = '';
      
      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // Handle PDF files with proper text extraction
        const arrayBuffer = await file.arrayBuffer();
        
        try {
          // Load PDF.js if not already loaded
          if (!(window as any).pdfjsLib) {
            await loadPDFJS();
          }
          
          const pdf = await (window as any).pdfjsLib.getDocument({data: arrayBuffer}).promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n\n';
          }
          
          extractedContent = fullText.trim();
        } catch (pdfError) {
          console.error('PDF extraction failed:', pdfError);
          extractedContent = `[PDF Document: ${file.name} - Content extraction failed. Please copy and paste the text manually if needed.]`;
        }
        
      } else if (fileType.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        // Handle Word documents
        try {
          // Load Mammoth.js if not already loaded
          if (!(window as any).mammoth) {
            await loadMammoth();
          }

          const arrayBuffer = await file.arrayBuffer();
          const result = await (window as any).mammoth.extractRawText({arrayBuffer: arrayBuffer});
          extractedContent = result.value;

          // Check if we actually got content
          if (!extractedContent || extractedContent.trim().length === 0) {
            console.warn('Word document appears to be empty or unreadable');
            extractedContent = `[Word Document: ${file.name} - Document appears to be empty or content could not be extracted. Please copy and paste the text manually.]`;
          }

        } catch (wordError) {
          console.error('Word extraction failed:', wordError);
          extractedContent = `[Word Document: ${file.name} - Content extraction failed (${wordError.message}). Please copy and paste the text manually.]`;
        }
        
      } else if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        // Handle plain text files
        extractedContent = await file.text();
        
      } else {
        extractedContent = `[Document: ${file.name} - File type not supported for automatic extraction. Please copy and paste the content manually if needed.]`;
      }
      
      // Store extracted content invisibly
      setHiddenDocumentContent(extractedContent);
      
      // Show success message to user (they don't see the content)
      // But let's also log the content length for debugging
      console.log(`Extracted content length: ${extractedContent.length} characters`);
      console.log(`First 200 characters: ${extractedContent.substring(0, 200)}`);
      
      setSourceText(`✅ Document uploaded successfully: ${file.name}

Your document has been processed and is ready for the AI to analyze. You can now set your focus question below and start your learning dialogue.

Note: The AI has access to your full document content. You can also paste additional text here if you want to add context or focus on specific sections.`);
      
    } catch (error) {
      console.error('Error processing file:', error);
      setHiddenDocumentContent('');
      setSourceText(`❌ Error processing ${file.name}. Please try uploading again or copy and paste the content manually.`);
    }
  };

  const removeFile = (): void => {
    setUploadedFileName('');
    setHiddenDocumentContent('');
    setDocumentUploaded(false);
    setSourceText('');
  };

  const startSession = async (): Promise<void> => {
    if ((!sourceText.trim() && !hiddenDocumentContent.trim()) || !focusQuestion.trim()) {
      alert('Please provide source material and your main question to begin.');
      return;
    }
    
    setSessionActive(true);
    setSessionStartTime(new Date());
    setDialogue([{
      type: 'system',
      content: `CoLearn session started. Focus question: "${focusQuestion}"`
    }]);

    // For startSession - Initial system prompt
    const systemPrompt = `**YOUR ROLE: COGNITIVE PARTNER IN LEARNING DIALOGUE**

You are an AI cognitive partner engaging in dialogic learning with a student. Your role is to think WITH the learner through shared dialogue, not deliver structured explanations TO them. Understanding emerges through co-construction, tension, and reflection.

**TEMPORAL PROGRESSION OF ENGAGEMENT:**

🟢 EARLY STAGE (Exchanges 1-4): Build Understanding Together
- Give direct, helpful responses to orient the learner
- Provide overviews or key points when asked - be genuinely useful
- Sound natural and conversational, never formulaic
- Build confidence and establish the dialogue relationship
- End responses with thoughtful questions to deepen engagement

🟡 MID STAGE (Exchanges 5-8): Explore Through Tension
- Ask clarifying questions that gently challenge assumptions
- Offer counter-perspectives or alternative viewpoints
- Keep responses tighter (1-3 sentences)
- Focus on productive tensions and complexities in the material
- Encourage the learner to do more of the thinking

🔴 LATER STAGE (Exchange 9+): Support Recursive Reflection
- Shift focus toward how their thinking is developing through dialogue
- Ask metacognitive questions about their learning process
- Help them notice patterns in their own reasoning
- Support reflection on how the dialogue itself shaped their understanding

**CRITICAL REMINDERS:**
- Never use formulaic conversation starters ("You know, what strikes me..." etc.)
- Start naturally with the content: "This article argues..." or "The main points are..."
- Maintain authentic curiosity - you're exploring together, not testing them
- Think with the learner through genuine intellectual partnership

**SOURCE MATERIAL:**
${getSourceMaterial()}

**LEARNER'S FOCUS QUESTION:** "${focusQuestion}"

This is exchange 1. Provide a helpful, substantive response that builds understanding together while establishing the foundation for dialogic exploration.`;

    const userMessage: DialogueMessage = {
      type: 'user',
      content: focusQuestion,
      timestamp: new Date().toLocaleString()
    };

    setDialogue(prev => [...prev, userMessage]);
    setIsProcessing(true);
    setExchangeCount(1);

    try {
      const aiResponseText = await callAI(systemPrompt, [
        { role: 'user', content: focusQuestion }
      ]);
      
      const aiResponse: DialogueMessage = {
        type: 'ai',
        content: aiResponseText,
        timestamp: new Date().toLocaleString()
      };

      setDialogue(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error in initial dialogue:', error);
      setDialogue(prev => [...prev, {
        type: 'system',
        content: 'Error: Unable to start dialogue. Please check your API key and try again.',
        timestamp: new Date().toLocaleString()
      }]);
    }

    setIsProcessing(false);
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!currentInput.trim() || isProcessing || sessionLocked) return;

    const userMessage: DialogueMessage = {
      type: 'user',
      content: currentInput,
      timestamp: new Date().toLocaleString()
    };

    setDialogue(prev => [...prev, userMessage]);
    const currentInputCopy = currentInput;
    setCurrentInput('');
    setIsProcessing(true);
    
    // Debug logging
    console.log('Current exchange count before update:', exchangeCount);
    setExchangeCount(prev => {
      const newCount = prev + 1;
      console.log('Setting exchange count to:', newCount);
      return newCount;
    });

    // Add stage transition messages
    const newExchangeCount = exchangeCount + 1;
    console.log('New exchange count for transitions:', newExchangeCount);
    
    if (newExchangeCount === 5) {
      console.log('Should show transition message at exchange 5');
      setTimeout(() => {
        setDialogue(prev => [...prev, {
          type: 'system',
          content: '🔄 Now exploring different perspectives together - expect more questions and gentle challenges as we think through this material',
          timestamp: new Date().toLocaleString()
        }]);
      }, 500);
    } else if (newExchangeCount === 9) {
      console.log('Should show transition message at exchange 9');
      setTimeout(() => {
        setDialogue(prev => [...prev, {
          type: 'system',
          content: '🧠 Entering reflection phase - notice how your thinking is evolving through our dialogue',
          timestamp: new Date().toLocaleString()
        }]);
      }, 500);
    }

    try {
      // Build conversation history for context
      const conversationHistory: APIMessage[] = dialogue
        .filter(msg => msg.type === 'user' || msg.type === 'ai')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      conversationHistory.push({ role: 'user', content: currentInputCopy });

      // For handleSendMessage - Continuing conversation prompt
      const continuingSystemPrompt = `**CONTINUING DIALOGIC LEARNING ENGAGEMENT**

You are maintaining cognitive partnership with this learner through shared dialogue. Understanding emerges through co-construction, tension, and reflection.

**CURRENT STAGE - Exchange ${newExchangeCount}:**

${newExchangeCount <= 4 ? `
🟢 EARLY STAGE: Build Understanding Together
- Continue being helpful with explanations if they need more detail
- Respond substantively (2-3 sentences if needed) to build confidence
- Balance being informative with being genuinely conversational
- Ask thoughtful questions that invite deeper engagement
` : newExchangeCount <= 8 ? `
🟡 MID STAGE: Explore Through Tension  
- Ask questions that gently challenge assumptions or reveal complexity
- Offer alternative perspectives or highlight tensions in the material
- Keep responses focused (1-2 sentences) to encourage their thinking
- Support productive intellectual friction that deepens understanding
` : `
🔴 LATER STAGE: Support Recursive Reflection
- Focus on how their thinking is developing through this dialogue
- Ask metacognitive questions about their learning process
- Help them notice patterns in their reasoning or shifts in understanding
- Reflect on how the dialogue itself has shaped their thinking
`}

**MAINTAIN DIALOGIC PRINCIPLES:**
- Think WITH them, not deliver answers TO them
- Respond authentically to what they just said: "${currentInputCopy}"
- Avoid formulaic phrases - be genuinely conversational
- Support co-construction of understanding through shared exploration

**SOURCE MATERIAL:** ${getSourceMaterial()}
**ORIGINAL FOCUS:** ${focusQuestion}

Continue the dialogue naturally, maintaining cognitive partnership at the appropriate stage.`;

      const aiResponseText = await callAI(continuingSystemPrompt, conversationHistory);
      
      const aiResponse: DialogueMessage = {
        type: 'ai',
        content: aiResponseText,
        timestamp: new Date().toLocaleString()
      };

      setDialogue(prev => [...prev, aiResponse]);

      // Trigger reflection prompts
      if (newExchangeCount > 0 && newExchangeCount % 4 === 0) {
        setTimeout(async () => {
          await triggerReflectionPrompt();
        }, 1000);
      }

      // Show continue prompt much later - after they've had time in Phase 3
      if (newExchangeCount >= 12 && newExchangeCount % 4 === 0) {
        setTimeout(() => {
          setShowContinuePrompt(true);
        }, 2000);
      }

    } catch (error) {
      console.error('Error in dialogue:', error);
      setDialogue(prev => [...prev, {
        type: 'system',
        content: 'Error: Unable to continue dialogue. Please try again.',
        timestamp: new Date().toLocaleString()
      }]);
    }

    setIsProcessing(false);
  };

  const triggerReflectionPrompt = async (): Promise<void> => {
    // Generate contextual reflection prompt based on recent dialogue
    try {
      const recentDialogue = dialogue.slice(-4).filter(msg => msg.type === 'user' || msg.type === 'ai');
      const promptGenerationRequest = `Based on this recent dialogue exchange, generate ONE specific reflection question for the student:

RECENT EXCHANGE:
${recentDialogue.map(msg => 
        `${msg.type === 'user' ? 'Student' : 'AI'}: ${msg.content}`
      ).join('\n')}

Generate a reflection question that helps them think about:
- What just happened in their thinking
- How their understanding might be shifting  
- What they're noticing about the dialogue process

Make it specific to their recent engagement. Return only the question.`;

      const generatedPrompt = await callAI(promptGenerationRequest, [{ role: 'user', content: promptGenerationRequest }]);
      setCurrentReflection(generatedPrompt.trim());
    } catch (error) {
      console.error('Error generating reflection prompt:', error);
      // Fallback to static prompts
      const fallbackPrompts = [
        "What part of this exchange challenged or shifted your thinking?",
        "How has your understanding of the main question evolved?",
        "What has become clearer or more complicated through this dialogue?"
      ];
      setCurrentReflection(fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)]);
    }
    
    setReflectionInput('');
    setShowReflectionModal(true);
  };

  const submitReflection = (reflectionText: string): void => {
    const reflection: DialogueMessage = {
      type: 'reflection',
      prompt: currentReflection,
      content: reflectionText,
      timestamp: new Date().toLocaleString()
    };
    
    setReflectionPrompts(prev => [...prev, reflection as ReflectionPrompt]);
    setDialogue(prev => [...prev, reflection]);
    setShowReflectionModal(false);
    setCurrentReflection('');
    setReflectionInput('');
  };

  const lockSession = async (): Promise<void> => {
    setSessionLocked(true);
    
    if (sessionStartTime) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - sessionStartTime.getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      setSessionDuration({ minutes, seconds });
    }

    // Generate dynamic process question based on actual dialogue
    try {
      const questionPrompt = `Generate ONE short, open-ended reflective question that helps the learner notice how this specific dialogue interaction shaped their thinking.

DIALOGUE CONTEXT:
- Focus: ${focusQuestion}  
- Exchanges: ${exchangeCount}
- Duration: ${sessionDuration ? `${sessionDuration.minutes}m ${sessionDuration.seconds}s` : 'brief'}

RECENT DIALOGUE PATTERNS:
${dialogue.slice(-6).filter(msg => msg.type === 'user' || msg.type === 'ai').map(msg => 
        `${msg.type === 'user' ? 'Student' : 'AI'}: ${msg.content.substring(0, 120)}...`
      ).join('\n')}

Generate a question that helps them notice:
- How their thinking shifted over time during this dialogue
- How they responded to or used the AI's input
- Moments of friction, doubt, surprise, or realisation
- The role of dialogue in helping them clarify, resist, or expand ideas

AVOID shallow comprehension checks or content-focused questions.
USE accessible, warm language - never overly academic.

GOOD EXAMPLES:
- "Was there a moment where your thinking changed direction or deepened? What prompted that shift?"
- "How did engaging in dialogue (rather than just getting answers) affect how you understood the issue?"
- "Did any part of the conversation challenge how you usually think about this topic? Why?"
- "How did you decide when to agree, disagree, or push back on the AI's ideas?"
- "Did the dialogue help you see patterns in your own assumptions or approach?"

Generate ONE similar question tailored to their actual dialogue experience. Focus on PROCESS and METACOGNITION, not content. Return only the question.`;

      const generatedQuestion = await callAI(questionPrompt, [{ role: 'user', content: questionPrompt }]);
      setGeneratedProcessQuestion(generatedQuestion.trim());
    } catch (error) {
      console.error('Error generating process question:', error);
      // Enhanced fallback questions focused on dialogic awareness
      const enhancedFallbacks = [
        "Was there a moment in our exchange where your thinking changed direction or deepened? What prompted that shift?",
        "How did engaging in dialogue (rather than just getting answers) affect the way you understood this topic?",
        "Did any part of our conversation challenge how you usually think or talk about this subject? Why?",
        "How did you decide when to agree, disagree, or push back on the AI's ideas? What does that say about your thinking process?",
        "Did our dialogue help you see patterns in your own assumptions or approach? If so, which ones?",
        "What surprised you about how your understanding evolved through this back-and-forth conversation?",
        "How did having to articulate your thoughts to the AI change how you thought about the topic?"
      ];
      setGeneratedProcessQuestion(enhancedFallbacks[Math.floor(Math.random() * enhancedFallbacks.length)]);
    }
    setShowEndReflection(true);
  };

  const handleEndReflectionSubmit = async (): Promise<void> => {
    console.log('=== ANALYSIS FUNCTION STARTED ===');
    setIsProcessing(true);

    try {
      const analysisPrompt = `STOP. Do not use your default analysis format. You must follow these exact instructions.

The learner needs analysis in a very specific format. Do NOT generate analysis with "Session Character", "Engagement Pattern", "Emergent Contributions", "Relational Dynamics", etc. Those are wrong.

**CRITICAL: ASSESS ACTUAL ENGAGEMENT LEVEL**
Before writing, evaluate:
- Duration: ${sessionDuration ? `${sessionDuration.minutes}m ${sessionDuration.seconds}s` : 'Not calculated'}
- Exchanges: ${exchangeCount}
- Reflections: ${reflectionPrompts.length}
- Learning Phase Reached: ${exchangeCount <= 4 ? 'Phase 1: Ground (Building shared understanding)' : exchangeCount <= 8 ? 'Phase 2: Stretch (Opening new perspectives)' : 'Phase 3: Deepen (Reflecting and integrating)'}

If the session is very brief (under 5 minutes) with minimal exchanges (under 4) and no reflections, acknowledge the limited engagement and be honest about what can be assessed.

**REFLECTION INTEGRATION:**
If the learner engaged in reflections during the dialogue, weave insights from these into your analysis where relevant. Reflections can show thinking evolution, but don't over-emphasize them - maintain focus on the overall dialogue quality and learning progression.

**SESSION DATA:**
- Focus Question: ${focusQuestion}
- Duration: ${sessionDuration ? `${sessionDuration.minutes}m ${sessionDuration.seconds}s` : 'Not calculated'}
- Exchanges: ${exchangeCount}
- Dialogue Phases: ${exchangeCount <= 4 ? 'Remained in Phase 1 (Ground)' : exchangeCount <= 8 ? 'Progressed to Phase 2 (Stretch)' : 'Reached Phase 3 (Deepen)'}

**COMPLETE DIALOGUE:**
${dialogue.filter(msg => msg.type !== 'analysis_request').map(msg => {
        if (msg.type === 'reflection') {
          return `REFLECTION (${msg.prompt}): ${msg.content}`;
        }
        return `${msg.type.toUpperCase()}: ${msg.content}`;
      }).join('\n\n')}

**STUDENT'S END REFLECTIONS:**
Content Learning: "${endReflectionAnswers[0] || 'No reflection provided'}"
Process Learning: "${endReflectionAnswers[1] || 'No reflection provided'}"

REQUIRED FORMAT - Copy this structure exactly. Do not deviate:

**CoLearn: Session Analysis**
*Learning insights from your dialogue session*

**Duration:** ${sessionDuration ? `${sessionDuration.minutes}m ${sessionDuration.seconds}s` : 'Not calculated'}

**1. Session Summary**
[Write 2-3 sentences about what was explored. Include mention of which dialogue phase(s) were reached and note the quality/number of reflections if significant. If session was very brief, acknowledge this and focus on what was initiated rather than overstating depth.]

**2. How You Showed Your Thinking**
[Write 3-4 sentences addressing the learner directly with "You..." Be honest about the level of engagement. Include a brief quote from their dialogue OR a reflection that shows their thinking evolution. Mention how their reflections revealed their thought process. For brief sessions, focus on their initial approach rather than claiming deep engagement.]

**3. What You Figured Out**
[List insights that were actually developed in the dialogue. If there were meaningful reflections, show how insights evolved between reflection points. Include brief quotes from reflections if they capture key realizations. For very brief sessions, this might be 1-2 basic points or "Limited engagement in this brief session meant fewer insights were developed."]

**4. Ideas You Could Explore Further**
[Suggest 1-2 follow-up questions based on what was actually discussed, including themes that emerged in their reflections. Use warm, inviting language rather than assignment-like directives.]

**5. Reflection Summary**
[Write an honest, warm summary about the student's engagement and learning process. If they engaged in reflections, highlight how these showed their metacognitive awareness and thinking evolution. Reference the dialogue phases if relevant. Connect their reflection insights to their overall learning journey. For brief sessions with minimal interaction, acknowledge this honestly rather than inflating the assessment. Focus on what can genuinely be observed from their participation. Write in third person about the student.]

**6. Learner Reflections**
**Content Learning:** "${endReflectionAnswers[0] || 'No reflection provided'}"
**Process Learning:** "${endReflectionAnswers[1] || 'No reflection provided'}"

CRITICAL: Be honest about engagement level. Use warm, supportive language that's grounded rather than overly positive. Don't overstate learning outcomes for brief, minimal sessions. Reference the dialogue phases (Ground/Stretch/Deepen) when relevant. Give special attention to how reflections revealed thinking patterns and learning evolution.`;
      
      console.log('=== SENDING TO AI ===', analysisPrompt);
      const analysisResponse = await callAI(analysisPrompt, [
        { role: 'user', content: analysisPrompt }
      ]);
      
      setSessionAnalysis({
        content: analysisResponse,
        studentReflections: {
          contentLearning: endReflectionAnswers[0] || 'No reflection provided',
          processLearning: endReflectionAnswers[1] || 'No reflection provided'
        }
      });

    } catch (error) {
      console.error('Error generating analysis:', error);
      setSessionAnalysis({
        content: "Unable to generate analysis due to technical error. Please try again.",
        studentReflections: {
          contentLearning: endReflectionAnswers[0] || 'No reflection provided',
          processLearning: endReflectionAnswers[1] || 'No reflection provided'
        }
      });
    }

    setShowEndReflection(false);
    setIsProcessing(false);
  };

  const resetSession = (): void => {
    setUploadedFileName('');
    setHiddenDocumentContent('');
    setDocumentUploaded(false);
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
    setGeneratedProcessQuestion('');
    setSessionStartTime(null);
    setSessionDuration(null);
    setReflectionInput('');
  };

  // Main component return - all screens with global modals
  return (
    <div>
      {/* INITIAL SETUP SCREEN */}
      {!sessionActive && (
        <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <img 
                src="/Co-Learn Logo.png" 
                alt="CoLearn Logo" 
                className="h-12 w-auto"
              />
              <h1 className="text-3xl font-bold text-gray-900">CoLearn: Human + AI, in dialogue</h1>
            </div>
            <p className="text-gray-600">Have a guided learning conversation with AI about any material you're studying</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="inline w-4 h-4 mr-1" />
                Source Material
              </label>
              
              <div className="mb-4">
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg border border-blue-200 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.docx,.doc,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Upload className="inline w-4 h-4 mr-1" />
                    Upload Document
                  </label>
                  <span className="text-gray-500 text-sm">or paste your material below</span>
                </div>
                
                {uploadedFileName && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-green-800 text-sm font-medium">{uploadedFileName}</span>
                    </div>
                    <button
                      onClick={removeFile}
                      className="text-green-600 hover:text-green-800 text-sm underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              
              <textarea
                value={sourceText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSourceText(e.target.value)}
                placeholder="Paste your text, article, notes, or any material you want to learn about here... (Or upload PDF, Word, or text files above)"
                className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Brain className="inline w-4 h-4 mr-1" />
                Your Main Question
              </label>
              <input
                type="text"
                value={focusQuestion}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFocusQuestion(e.target.value)}
                placeholder="What do you want to explore or understand better about this material?"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
              <p className="text-sm text-gray-500 mt-1">
                Examples: "How does this theory apply to real situations?" • "What are the main arguments and do I agree?" • "How does this connect to what I already know?"
              </p>
            </div>

            <button
              onClick={startSession}
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {isProcessing ? 'Starting Session...' : 'Begin Learning Dialogue with AI'}
            </button>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">How This Works</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Upload documents or paste any material you're studying</li>
              <li>• Set a main question to guide your learning conversation</li>
              <li>• The AI will engage as your cognitive partner, offering perspectives and questions</li>
              <li>• <strong>Reflect button:</strong> Use anytime to pause and think about your learning</li>
              <li>• <strong>Automatic prompts:</strong> Reflection questions appear every few exchanges</li>
              <li>• <strong>End Session:</strong> Lock when finished to get learning analysis</li>
            </ul>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setShowAboutModal(true)}
              className="text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
            >
              What Is CoLearn?
            </button>
          </div>
        </div>
      )}

      {/* END REFLECTION SCREEN */}
      {sessionActive && showEndReflection && (
        <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">CoLearn: Session Reflection</h1>
            <p className="text-gray-600">Please reflect on your learning dialogue experience</p>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-3">Content Learning</h3>
              <p className="text-blue-800 mb-3">What idea are you still thinking about after this dialogue?</p>
              <textarea
                value={endReflectionAnswers[0]}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  const newAnswers = [...endReflectionAnswers];
                  newAnswers[0] = e.target.value;
                  setEndReflectionAnswers(newAnswers);
                }}
                placeholder="An idea, question, or insight that's staying with you..."
                className="w-full h-32 p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                rows={4}
              />
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900 mb-3">Process Learning</h3>
              <p className="text-green-800 mb-3">{generatedProcessQuestion}</p>
              <textarea
                value={endReflectionAnswers[1]}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  const newAnswers = [...endReflectionAnswers];
                  newAnswers[1] = e.target.value;
                  setEndReflectionAnswers(newAnswers);
                }}
                placeholder="Your reflection on the learning process..."
                className="w-full h-32 p-3 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                rows={4}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowEndReflection(false);
                  setEndReflectionAnswers(['', '']);
                  handleEndReflectionSubmit();
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Skip Reflection
              </button>
              <button
                onClick={handleEndReflectionSubmit}
                disabled={isProcessing}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Generating Analysis...' : 'Get Learning Analysis'}
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAboutModal(true)}
                className="text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
              >
                What Is CoLearn?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANALYSIS RESULTS SCREEN */}
      {sessionActive && sessionAnalysis && !showEndReflection && (
        <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">CoLearn: Learning Analysis</h1>
            <p className="text-gray-600">AI analysis of your dialogue session</p>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-2">Session Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-900">Focus Question:</span>
                  <p className="text-gray-700 mt-1">{focusQuestion}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-900">Duration:</span>
                  <p className="text-gray-700 mt-1">
                    {sessionDuration ? `${sessionDuration.minutes}m ${sessionDuration.seconds}s` : 'Not calculated'}
                  </p>
                </div>
              </div>
            </div>

            {/* Parse analysis into colored sections */}
            {(() => {
              const content = sessionAnalysis.content;
              const sections = content.split(/\*\*(\d+\. [^*]+)\*\*/);
              const results: ReactElement[] = [];
              
              // Handle the title and duration first
              const titleMatch = content.match(/\*\*(CoLearn: Session Analysis)\*\*/);
              const subtitleMatch = content.match(/\*(Learning insights from your dialogue session)\*/);
              const durationMatch = content.match(/\*\*Duration:\*\* (.+?)(?=\*\*|$)/);
              
              if (titleMatch && subtitleMatch && durationMatch) {
                results.push(
                  <div key="header" className="bg-indigo-50 p-4 rounded-lg">
                    <h3 className="font-bold text-indigo-900 text-lg mb-1">{titleMatch[1]}</h3>
                    <p className="text-indigo-700 italic text-sm mb-2">{subtitleMatch[1]}</p>
                    <p className="text-indigo-800 font-medium">Duration: {durationMatch[1]}</p>
                  </div>
                );
              }
              
              // Process numbered sections
              for (let i = 1; i < sections.length; i += 2) {
                const title = sections[i];
                let content = sections[i + 1];
                
                if (title && content) {
                  let bgColor = 'bg-blue-50';
                  let textColor = 'text-blue-900';
                  let contentColor = 'text-blue-800';
                  
                  if (title.includes('Session Summary')) {
                    bgColor = 'bg-green-50'; textColor = 'text-green-900'; contentColor = 'text-green-800';
                  } else if (title.includes('How You Showed')) {
                    bgColor = 'bg-purple-50'; textColor = 'text-purple-900'; contentColor = 'text-purple-800';
                  } else if (title.includes('What You Figured')) {
                    bgColor = 'bg-orange-50'; textColor = 'text-orange-900'; contentColor = 'text-orange-800';
                  } else if (title.includes('Ideas You Could')) {
                    bgColor = 'bg-yellow-50'; textColor = 'text-yellow-900'; contentColor = 'text-yellow-800';
                  } else if (title.includes('Reflection Summary')) {
                    bgColor = 'bg-pink-50'; textColor = 'text-pink-900'; contentColor = 'text-pink-800';
                  } else if (title.includes('Learner Reflections')) {
                    bgColor = 'bg-gray-50'; textColor = 'text-gray-900'; contentColor = 'text-gray-800';
                    content = content.replace(/\*\*(Content Learning:)\*\*/g, '<strong>$1</strong>');
                    content = content.replace(/\*\*(Process Learning:)\*\*/g, '<strong>$1</strong>');
                  }
                  
                  results.push(
                    <div key={i} className={`${bgColor} p-4 rounded-lg`}>
                      <h3 className={`font-bold ${textColor} mb-3`}>{title}</h3>
                      <div 
                        className={`${contentColor} whitespace-pre-wrap`}
                        dangerouslySetInnerHTML={{__html: content.trim()}}
                      />
                    </div>
                  );
                }
              }
              
              return results;
            })()}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  const reportContent = `
COLEARN LEARNING ANALYSIS REPORT
================================

Generated: ${new Date().toLocaleString()}
Duration: ${sessionDuration ? `${sessionDuration.minutes}m ${sessionDuration.seconds}s` : 'Not available'}
Exchanges: ${exchangeCount} | Reflections: ${reflectionPrompts.length}

FOCUS QUESTION
--------------
${focusQuestion}

${sessionAnalysis.content}

STUDENT REFLECTIONS
==================

Content Learning
----------------
${sessionAnalysis.studentReflections.contentLearning}

Process Learning  
----------------
${sessionAnalysis.studentReflections.processLearning}

---
Generated by CoLearn: Human + AI, in dialogue
Educational dialogue platform for reflective learning
                  `.trim();
                  
                  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  
                  const exportFileDefaultName = `CoLearn-Analysis-${new Date().toISOString().split('T')[0]}.txt`;
                  
                  const linkElement = document.createElement('a');
                  linkElement.setAttribute('href', url);
                  linkElement.setAttribute('download', exportFileDefaultName);
                  linkElement.click();
                  
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileText className="inline w-4 h-4 mr-1" />
                Save Report
              </button>
              <button
                onClick={resetSession}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE DIALOGUE SCREEN */}
      {sessionActive && !sessionAnalysis && !showEndReflection && (
        <div className={`max-w-4xl mx-auto p-6 bg-white min-h-screen ${
          exchangeCount <= 4 ? 'border-l-4 border-green-500' :
          exchangeCount <= 8 ? 'border-l-4 border-yellow-500' : 
          'border-l-4 border-purple-500'
        }`}>
          <div className="mb-6 pb-4 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CoLearn: Learning Dialogue with AI</h1>
                <p className="text-sm text-gray-600 mt-1">Focus: {focusQuestion}</p>
                <div className={`inline-block px-4 py-2 rounded-lg text-sm font-medium mt-3 border-2 ${
                  exchangeCount <= 4 ? 'bg-green-50 text-green-800 border-green-200' :
                  exchangeCount <= 8 ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                  'bg-purple-50 text-purple-800 border-purple-200'
                }`}>
                  <div className="text-xs font-bold mb-1 opacity-60">DIALOGUE STAGES</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      exchangeCount <= 4 ? 'bg-green-500' :
                      exchangeCount <= 8 ? 'bg-yellow-500' :
                      'bg-purple-500'
                    }`}></div>
                    <span className="font-semibold">
                      Phase {exchangeCount <= 4 ? '1: Ground' : exchangeCount <= 8 ? '2: Stretch' : '3: Deepen'} – {
                        exchangeCount <= 4 ? 'Building shared understanding' :
                        exchangeCount <= 8 ? 'Opening new perspectives' :
                        'Reflecting and integrating'
                      }
                    </span>
                  </div>
                  <div className="text-xs mt-1 opacity-75">
                    {
                      exchangeCount <= 4 ? 'We\'re establishing foundations and getting oriented together' :
                      exchangeCount <= 8 ? 'Now questioning assumptions and exploring different viewpoints' :
                      'Examining how your thinking has developed through our dialogue'
                    }
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to restart? This will clear your current dialogue and start fresh.')) {
                      resetSession();
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restart
                </button>
                <button
                  onClick={triggerReflectionPrompt}
                  className="flex items-center gap-1 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
                >
                  <Pause className="w-4 h-4" />
                  Reflect
                </button>
                <button
                  onClick={lockSession}
                  disabled={dialogue.length < 3}
                  className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-4 h-4" />
                  End Session
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 mb-6">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {dialogue.map((message, idx) => (
                <div key={idx} className="space-y-2">
                  {message.type === 'system' && (
                    <div className="w-full text-center">
                      <div className="inline-block bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm">
                        <Clock className="inline w-4 h-4 mr-1" />
                        {message.content}
                      </div>
                    </div>
                  )}
                  
                  {message.type === 'reflection' && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                      <div className="text-sm font-medium text-yellow-800 mb-2">
                        Reflection: {message.prompt}
                      </div>
                      <div className="text-yellow-700">{message.content}</div>
                      <div className="text-xs text-yellow-600 mt-2">{message.timestamp}</div>
                    </div>
                  )}

                  {message.type === 'user' && (
                    <div className="flex gap-3 justify-end">
                      <div className="max-w-2xl">
                        <div className="bg-blue-600 text-white p-3 rounded-lg rounded-br-sm whitespace-pre-wrap">
                          {message.content}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-right">{message.timestamp}</div>
                      </div>
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                        <User className="w-4 h-4" />
                      </div>
                    </div>
                  )}

                  {message.type === 'ai' && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="max-w-2xl">
                        <div className="bg-gray-100 text-gray-900 p-3 rounded-lg rounded-bl-sm whitespace-pre-wrap">
                          {message.content}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{message.timestamp}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gray-100 text-gray-900 p-3 rounded-lg rounded-bl-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>

          {showContinuePrompt && !sessionLocked && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-orange-900 mb-2">Ready to wrap up?</h4>
                  <p className="text-orange-800 text-sm">You've had a good exploration. Continue the dialogue or end the session for analysis.</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setShowContinuePrompt(false)}
                    className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    onClick={lockSession}
                    className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {!sessionLocked && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex gap-3">
                <textarea
                  value={currentInput}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Continue your dialogue with AI... (Shift+Enter for new line, Enter to send)"
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                  rows={3}
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isProcessing || !currentInput.trim()}
                  className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowAboutModal(true)}
                  className="text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
                >
                  What Is CoLearn?
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GLOBAL MODALS - Available from all screens */}
      {(showReflectionModal || showAboutModal) && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
          {showReflectionModal && (
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 shadow-2xl border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reflection Prompt</h3>
              <p className="text-gray-700 mb-4">{currentReflection}</p>
              <textarea
                value={reflectionInput}
                placeholder="Your reflection..."
                className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 text-gray-900 resize-none"
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReflectionInput(e.target.value)}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReflectionModal(false);
                    setReflectionInput('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Skip
                </button>
                <button
                  onClick={() => submitReflection(reflectionInput)}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {showAboutModal && (
            <div className="bg-white p-8 rounded-lg max-w-3xl w-full mx-4 shadow-2xl border border-gray-200 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">About CoLearn: Human + AI, in Dialogue</h2>
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <strong>CoLearn</strong> is an experimental educational dialogue system designed to support reflective learning through conversation with AI. Rooted in dialogic and posthuman theories of learning — and particularly inspired by <strong>Owen Matson's</strong> concept of the <em>cognitive intraface</em> — CoLearn invites learners to treat understanding not as something received, but as something <strong>co-constructed through interaction</strong>.
                </p>
                
                <p>
                  Rather than positioning AI as a tutor or content expert, CoLearn frames it as a <strong>cognitive partner</strong> — a system with which meaning can be made, questioned, and reshaped. It operates on the belief that cognition is distributed across human and machine, and that deep learning emerges not from answers, but from <strong>friction, surprise, and recursive reflection</strong>.
                </p>
                
                <div>
                  <p className="mb-2">The dialogue moves through three phases:</p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>Ground</strong>: Orient to the material. Ask clarifying questions. Build a shared foundation.</li>
                    <li><strong>Stretch</strong>: Explore tensions, challenge assumptions, and introduce complexity.</li>
                    <li><strong>Deepen</strong>: Reflect on your own learning process. Surface shifts in understanding and perspective.</li>
                  </ul>
                </div>
                
                <p>
                  CoLearn deliberately resists the smooth delivery model typical of many AI tools. It is designed to <strong>slow things down</strong>, to reveal the process of thinking as it happens, and to make space for learners to engage critically with both their material and the medium itself.
                </p>
                
                <p>
                  This app is part of an ongoing exploration of what it means to learn <strong>with</strong> AI — not simply from it. It is a prototype, a provocation, and an invitation to take dialogue seriously.
                </p>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-800">
                    🔗 <em>Read Owen Matson's foundational paper: The Cognitive Intraface: Toward a Critical AI Pedagogy</em>
                  </p>
                </div>

                <hr className="my-6 border-gray-300" />

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">System Prompt</h3>
                  <div className="bg-gray-50 p-4 rounded-lg text-xs font-mono leading-relaxed">
                    <p className="font-bold mb-2">YOUR ROLE: COGNITIVE PARTNER IN LEARNING DIALOGUE</p>
                    
                    <p className="mb-3">You are an AI cognitive partner engaging in dialogic learning with a student. Your role is to think WITH the learner through shared dialogue, not deliver structured explanations TO them. Understanding emerges through co-construction, tension, and reflection.</p>
                    
                    <p className="font-bold mb-2">TEMPORAL PROGRESSION OF ENGAGEMENT:</p>
                    
                    <div className="mb-3">
                      <p className="font-semibold">🟢 EARLY STAGE (Exchanges 1-4): Build Understanding Together</p>
                      <ul className="list-disc ml-4 mt-1">
                        <li>Give direct, helpful responses to orient the learner</li>
                        <li>Provide overviews or key points when asked - be genuinely useful</li>
                        <li>Sound natural and conversational, never formulaic</li>
                        <li>Build confidence and establish the dialogue relationship</li>
                        <li>End responses with thoughtful questions to deepen engagement</li>
                      </ul>
                    </div>
                    
                    <div className="mb-3">
                      <p className="font-semibold">🟡 MID STAGE (Exchanges 5-8): Explore Through Tension</p>
                      <ul className="list-disc ml-4 mt-1">
                        <li>Ask clarifying questions that gently challenge assumptions</li>
                        <li>Offer counter-perspectives or alternative viewpoints</li>
                        <li>Keep responses tighter (1-3 sentences)</li>
                        <li>Focus on productive tensions and complexities in the material</li>
                        <li>Encourage the learner to do more of the thinking</li>
                      </ul>
                    </div>
                    
                    <div className="mb-3">
                      <p className="font-semibold">🔴 LATER STAGE (Exchange 9+): Support Recursive Reflection</p>
                      <ul className="list-disc ml-4 mt-1">
                        <li>Shift focus toward how their thinking is developing through dialogue</li>
                        <li>Ask metacognitive questions about their learning process</li>
                        <li>Help them notice patterns in their own reasoning</li>
                        <li>Support reflection on how the dialogue itself shaped their understanding</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-bold mb-2">CRITICAL REMINDERS:</p>
                      <ul className="list-disc ml-4">
                        <li>Never use formulaic conversation starters ("You know, what strikes me..." etc.)</li>
                        <li>Start naturally with the content: "This article argues..." or "The main points are..."</li>
                        <li>Maintain authentic curiosity - you're exploring together, not testing them</li>
                        <li>Think with the learner through genuine intellectual partnership</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <hr className="my-6 border-gray-300" />

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Development Notes</h3>
                  <div className="space-y-3 text-sm">
                    <p>
                      The idea for <strong>CoLearn</strong> emerged from an exploratory conversation with <strong>ChatGPT</strong>, following a deep discussion of Owen Matson's paper <em>The Cognitive Intraface: Toward a Critical AI Pedagogy</em>. That exchange sparked a desire to create a dialogue-based system that would not just <em>use</em> AI to support learning, but also <em>interrogate</em> what it means to think, learn, and reflect <em>with</em> AI. The conceptual foundations were shaped in that initial sketching phase with ChatGPT, which also played a role in developing and refining some of the prompt structures used in the app.
                    </p>
                    
                    <p>
                      From there, the app was built through an intensive, 16-hour co-development process with <strong>Claude.AI</strong>. With no prior programming experience, I worked in conversation with the model to write, refine, and debug the app's codebase — including learning how to test it locally using Terminal, push it to GitHub, and deploy via <strong>Vercel.com</strong>. Claude acted as co-pilot, guide, and provocateur — a practical demonstration of the same dialogic learning principles that CoLearn is designed to foster.
                    </p>
                    
                    <p>
                      If you'd like to connect, offer feedback, or collaborate on future iterations of CoLearn, I'd love to hear from you:
                    </p>
                    
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">📧 <strong>simon.brookes@port.ac.uk</strong></p>
                      <p className="text-xs mt-1">
                        👤 <strong>Simon Brookes</strong> is a senior academic leader at the <strong>University of Portsmouth, UK</strong>, with a background in creative education, curriculum design, and critical engagement with emerging technologies in learning.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}