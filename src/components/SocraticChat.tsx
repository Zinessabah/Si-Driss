import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  BookOpen,
  RefreshCw,
  Volume2,
  Lightbulb,
  MessageSquare,
  Zap,
  Bookmark,
  Plus,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  GraduationCap,
  Eye,
  FileCheck,
  CheckCircle,
  HelpCircle,
  Key,
  Copy,
  Check,
  Sigma,
} from 'lucide-react';
import { MathView } from './MathView';
import { SessionManagerModal, SavedSession, ChatMessage, ChatAttachment } from './SessionManagerModal';
import { ExercisePickerModal } from './ExercisePickerModal';
import { DocumentPickerModal } from './DocumentPickerModal';
import { useApiKey } from '../hooks/useApiKey';
import { useBranch } from '../hooks/useBranch';
import { ApiKeyModal } from './ApiKeyModal';

interface SocraticChatProps {
  initialPrompt?: string;
  currentContext?: string;
  externalLoadSession?: SavedSession | null;
  externalNewChatTrigger?: number;
  onSessionsUpdated?: (sessions: SavedSession[], activeId: string) => void;
}

const QUICK_FORMULAS_PC = [
  { label: 'Constante tau (RC)', formula: '\\tau = RC' },
  { label: 'Constante tau (RL)', formula: '\\tau = \\frac{L}{R_T}' },
  { label: 'Période propre (LC)', formula: 'T_0 = 2\\pi\\sqrt{LC}' },
  { label: '2ème Loi de Newton', formula: '\\sum \\vec{F}_{ext} = m \\vec{a}_G' },
  { label: 'Vitesse limite (Chute)', formula: 'v_{lim} = \\frac{A}{B}' },
  { label: 'Taux mod. AM', formula: 'm = \\frac{U_{max}-U_{min}}{U_{max}+U_{min}}' },
  { label: 'Diffraction', formula: '\\theta = \\frac{\\lambda}{a}' },
  { label: 'Demi-vie radioactive', formula: 't_{1/2} = \\frac{\\ln 2}{\\lambda}' },
  { label: 'pH acido-basique', formula: 'pH = pK_A + \\log\\frac{[A^-]}{[AH]}' },
  { label: 'Électrolyse (Faraday)', formula: 'Q = I \\cdot \\Delta t = n(e^-) \\cdot F' },
];

const QUICK_FORMULAS_SM = [
  { label: 'RFD en rotation', formula: '\\sum M_\\Delta = J_\\Delta \\ddot{\\theta}' },
  { label: 'Énergie cinétique rot.', formula: 'E_c = \\frac{1}{2}J_\\Delta \\dot{\\theta}^2' },
  { label: 'Impédance RLC forcé', formula: 'Z = \\sqrt{R_t^2 + \\left(L\\omega - \\frac{1}{C\\omega}\\right)^2}' },
  { label: 'Facteur de qualité Q', formula: 'Q = \\frac{L\\omega_0}{R_t}' },
  { label: 'Bande passante', formula: '\\Delta N = \\frac{N_0}{Q}' },
  { label: 'Surtension condensateur', formula: 'U_{C,max} = Q \\cdot U_m' },
  { label: 'Constante tau (RC)', formula: '\\tau = RC' },
  { label: 'Période propre (LC)', formula: 'T_0 = 2\\pi\\sqrt{LC}' },
  { label: '2ème Loi de Newton', formula: '\\sum \\vec{F}_{ext} = m \\vec{a}_G' },
  { label: 'pH acido-basique', formula: 'pH = pK_A + \\log\\frac{[A^-]}{[AH]}' },
];

function getWelcomeMessage(branch: 'PC' | 'SM' = 'PC'): ChatMessage {
  const isSM = branch === 'SM';
  const branchTitle = isSM ? '2ème Bac Sciences Mathématiques (SM)' : '2ème Bac Sciences Physiques (PC)';
  const syllabusHighlights = isSM
    ? `• **Spécificités SM** : Rotation solide (RFD : $\\sum M_\\Delta = J_\\Delta \\ddot{\\theta}$), RLC forcé ($Z$, bande passante à $-3\\text{ dB}$, facteur $Q$).`
    : `• **Spécificités PC** : Modulation AM ($m < 1$, trapèze), chute verticale avec frottement et méthode d'Euler.`;

  return {
    id: 'welcome',
    role: 'assistant',
    content: `Salam aleykoum ! Bienvenue mon cher élève de **${branchTitle}**. Je suis **Si Driss**, ton professeur de Physique-Chimie.

${syllabusHighlights}

Tu peux me poser une question de cours, me demander une démonstration, ou joindre un énoncé d'exercice avec le bouton **+** ci-dessous.`,
    timestamp: 'Maintenant',
  };
}

export const SocraticChat: React.FC<SocraticChatProps> = ({
  initialPrompt,
  currentContext,
  externalLoadSession,
  externalNewChatTrigger,
  onSessionsUpdated,
}) => {
  // Socratic mode disabled by default at startup as requested
  const [socraticEnabled, setSocraticEnabled] = useState<boolean>(false);
  const [coachingMode, setCoachingMode] = useState<'socratic' | 'direct' | 'review' | 'trap'>('direct');

  // Session identification and storage
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    try {
      const active = localStorage.getItem('sidriss_active_session_v1');
      if (active) {
        const parsed = JSON.parse(active);
        if (parsed.id) return parsed.id;
      }
    } catch {}
    return `session_${Date.now()}`;
  });

  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('Nouvelle discussion');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // API Key management
  const { apiKey, hasApiKey, getAuthHeaders } = useApiKey();
  const { branch, isSM } = useBranch();
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  // Attachments & modals state
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isFormulaMenuOpen, setIsFormulaMenuOpen] = useState<boolean>(false);
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState<boolean>(false);
  const [isDocPickerOpen, setIsDocPickerOpen] = useState<boolean>(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const formulaMenuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Saved sessions list
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => {
    try {
      const raw = localStorage.getItem('sidriss_saved_sessions_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const currentStoredBranch = (localStorage.getItem('sidriss_student_branch_v1') as 'PC' | 'SM') || 'PC';
      const active = localStorage.getItem('sidriss_active_session_v1');
      if (active) {
        const parsed = JSON.parse(active);
        if (parsed.messages && parsed.messages.length > 0) {
          return parsed.messages;
        }
      }
      return [getWelcomeMessage(currentStoredBranch)];
    } catch {
      return [getWelcomeMessage('PC')];
    }
  });

  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Inform parent of sessions list
  useEffect(() => {
    onSessionsUpdated?.(savedSessions, currentSessionId);
  }, [savedSessions, currentSessionId, onSessionsUpdated]);

  // Handle external new chat trigger from sidebar
  const lastNewChatTriggerRef = useRef<number | undefined>(externalNewChatTrigger);
  useEffect(() => {
    if (externalNewChatTrigger !== undefined && externalNewChatTrigger !== lastNewChatTriggerRef.current) {
      lastNewChatTriggerRef.current = externalNewChatTrigger;
      handleNewSession();
    }
  }, [externalNewChatTrigger]);

  // Handle external session load from sidebar
  useEffect(() => {
    if (externalLoadSession && externalLoadSession.id !== currentSessionId) {
      handleLoadSession(externalLoadSession);
    }
  }, [externalLoadSession]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
      if (formulaMenuRef.current && !formulaMenuRef.current.contains(event.target as Node)) {
        setIsFormulaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Auto-save current active session
  useEffect(() => {
    if (messages.length === 0) return;
    const now = new Date();

    try {
      const sessionPayload = {
        id: currentSessionId,
        title: currentSessionTitle,
        messages,
        socraticEnabled,
        coachingMode,
        updatedAt: now.toISOString(),
      };
      localStorage.setItem('sidriss_active_session_v1', JSON.stringify(sessionPayload));
    } catch (e) {
      console.error('Failed to auto-save active session:', e);
    }
  }, [messages, socraticEnabled, coachingMode, currentSessionId, currentSessionTitle]);

  // Synchronize welcome message when student switches branch
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [getWelcomeMessage(branch)];
      }
      return prev;
    });
  }, [branch]);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleSocratic = (enabled: boolean) => {
    setSocraticEnabled(enabled);
    if (!enabled && coachingMode === 'socratic') {
      setCoachingMode('direct');
    } else if (enabled && coachingMode === 'direct') {
      setCoachingMode('socratic');
    }
  };

  const handleNewSession = () => {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length > 0) {
      const autoTitle = userMessages[0].content.slice(0, 45).replace(/\n/g, ' ');
      const existing = savedSessions.find((s) => s.id === currentSessionId);
      if (!existing) {
        const archived: SavedSession = {
          id: currentSessionId,
          title: autoTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages,
          socraticEnabled,
          coachingMode,
        };
        const updated = [archived, ...savedSessions];
        setSavedSessions(updated);
        try {
          localStorage.setItem('sidriss_saved_sessions_v1', JSON.stringify(updated));
        } catch {}
      }
    }

    const newId = `session_${Date.now()}`;
    setCurrentSessionId(newId);
    setCurrentSessionTitle('Nouvelle discussion');
    setMessages([getWelcomeMessage(branch)]);
    setPendingAttachments([]);
    try {
      localStorage.removeItem('sidriss_active_session_v1');
    } catch {}
  };

  const handleLoadSession = (session: SavedSession) => {
    setCurrentSessionId(session.id);
    setCurrentSessionTitle(session.title);
    setMessages(session.messages);
    setSocraticEnabled(session.socraticEnabled);
    setCoachingMode(session.coachingMode);
    setPendingAttachments([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isImg) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const newAtt: ChatAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            type: 'image',
            mimeType: file.type || 'image/png',
            data: dataUrl,
            previewUrl: dataUrl,
            size: file.size,
          };
          setPendingAttachments((prev) => [...prev, newAtt]);
        };
        reader.readAsDataURL(file);
      } else if (isPdf) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const newAtt: ChatAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            type: 'pdf',
            mimeType: 'application/pdf',
            data: dataUrl,
            size: file.size,
          };
          setPendingAttachments((prev) => [...prev, newAtt]);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const textContent = event.target?.result as string;
          const newAtt: ChatAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            type: 'text',
            mimeType: 'text/plain',
            text: textContent,
            size: file.size,
          };
          setPendingAttachments((prev) => [...prev, newAtt]);
        };
        reader.readAsText(file);
      }
    });

    setIsAddMenuOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectExercise = (attachment: ChatAttachment, defaultPrompt?: string) => {
    if (defaultPrompt) {
      handleSend(defaultPrompt, [attachment]);
    } else {
      setPendingAttachments((prev) => [...prev, attachment]);
      if (!input.trim()) {
        setInput(`Si Driss, voici l'exercice "${attachment.name}". Peux-tu m'aider à le résoudre méthodiquement ?`);
      }
    }
    setIsAddMenuOpen(false);
  };

  const handleSelectDoc = (attachment: ChatAttachment) => {
    setPendingAttachments((prev) => [...prev, attachment]);
    if (!input.trim()) {
      setInput(`Si Driss, j'ai joint le document officiel "${attachment.name}". Peux-tu m'expliquer les points clés pour le National ?`);
    }
    setIsAddMenuOpen(false);
  };

  const handleInsertTemplate = () => {
    const template = `📚 **Exercice :** [Précise le chapitre : RC, RLC, Newton, Titrage...]
📋 **Énoncé / Données numériques :** 
❓ **Question où je bloque :** 
💡 **Mon début de raisonnement :** `;
    setInput(template);
    setIsAddMenuOpen(false);
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async (textToSend?: string, customAttachments?: ChatAttachment[]) => {
    const text = textToSend !== undefined ? textToSend : input;
    const attsToSend = customAttachments || pendingAttachments;

    if ((!text.trim() && attsToSend.length === 0) || loading) return;

    if (!hasApiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    const currentMode = !socraticEnabled ? 'direct' : coachingMode;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text.trim() || (attsToSend.length > 0 ? "Voici l'exercice ou le document joint que je souhaite étudier avec toi :" : ''),
      mode: currentMode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: attsToSend.length > 0 ? [...attsToSend] : undefined,
    };

    // Auto-update session title on first user message
    if (messages.filter((m) => m.role === 'user').length === 0) {
      const generatedTitle = text.slice(0, 38).trim() || 'Session d\'exercices';
      setCurrentSessionTitle(generatedTitle);
    }

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setPendingAttachments([]);
    setIsAddMenuOpen(false);
    setIsFormulaMenuOpen(false);
    setLoading(true);

    const assistantMsgId = String(Date.now() + 1);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const streamRes = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          context: currentContext,
          mode: currentMode,
          socraticEnabled,
          branch,
        }),
      });

      if (streamRes.status === 401) {
        clearTimeout(timeoutId);
        setIsApiKeyModalOpen(true);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: '⚠️ **Clé API Gemini requise** : Renseigne ta clé API gratuite Google AI Studio pour que Si Driss puisse te répondre.',
            mode: currentMode,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setLoading(false);
        return;
      }

      if (streamRes.ok && streamRes.body) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            mode: currentMode,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  accumulated += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
                  );
                } else if (parsed.error) {
                  accumulated = `⚠️ *Note du professeur* : ${parsed.error}`;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
                  );
                }
              } catch {}
            }
          }
        }

        if (!accumulated.trim()) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              messages: newMessages.map((m) => ({
                role: m.role,
                content: m.content,
                attachments: m.attachments,
              })),
              context: currentContext,
              mode: currentMode,
              socraticEnabled,
              branch,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: data.reply || 'Je suis à ton écoute mon élève !' }
                  : m
              )
            );
          }
        }
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments,
            })),
            context: currentContext,
            mode: currentMode,
            socraticEnabled,
            branch,
          }),
        });

        if (!res.ok) throw new Error('Erreur de réponse du serveur');
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: data.reply || 'Je suis à ton écoute !',
            mode: currentMode,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const isTimeout = err?.name === 'AbortError';
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== assistantMsgId || m.content.trim() !== ''),
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: isTimeout
            ? "⏱️ **Temps d'attente dépassé** : La réponse a pris un peu trop de temps. Clique sur le bouton d'envoi pour réessayer, ou reformule brièvement ta question, lah yerdi 3lik !"
            : "Désolé mon élève, une brève coupure de connexion. Peux-tu renvoyer ton message, lah yerdi 3lik ?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const insertFormula = (formula: string) => {
    setInput((prev) => (prev ? `${prev} $${formula}$ ` : `$${formula}$ `));
    setIsFormulaMenuOpen(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/\$+/g, '')
        .replace(/\*+/g, '')
        .replace(/#/g, '')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 sur $2')
        .replace(/\\tau/g, 'tau')
        .replace(/\\lambda/g, 'lambda');

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const hasUserMessages = messages.some((m) => m.role === 'user');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131314] relative text-[#e3e3e3] overflow-hidden">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,application/pdf,.txt,.md"
        multiple
        className="hidden"
      />

      {/* Main Chat Canvas Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 no-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* GEMINI EMPTY STATE: Shown when no question has been asked yet */}
          {!hasUserMessages && (
            <div className="py-8 sm:py-16 space-y-8 animate-in fade-in duration-300">
              {/* Gemini Greeting Title */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center shadow-md">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xl sm:text-2xl font-medium text-[#c4c7c5]">
                    Salam mon élève,
                  </span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
                  <span className="bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#f59e0b] bg-clip-text text-transparent">
                    Que veux-tu réviser aujourd'hui ?
                  </span>
                </h2>
                <p className="text-sm text-[#8e918f] pt-1">
                  Je suis <strong>Si Driss</strong>, ton professeur de Physique-Chimie pour le{' '}
                  <span className="text-[#e3e3e3] font-medium">
                    2ème Bac {branch === 'SM' ? 'Sciences Mathématiques' : 'Sciences Physiques'}
                  </span>
                  .
                </p>
              </div>

              {/* 4 Gemini Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSend(
                      isSM
                        ? "Si Driss, guide-moi pas à pas pour établir la relation fondamentale de la dynamique en rotation autour d'un axe fixe."
                        : "Si Driss, guide-moi pas à pas pour établir l'équation différentielle de la tension u_C(t) lors de la charge d'un condensateur RC."
                    )
                  }
                  className="p-4 rounded-2xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#3c4043] transition-all text-left flex flex-col justify-between group shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-xs font-semibold text-[#e3e3e3]">
                      Équations différentielles
                    </span>
                    <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Lightbulb className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xs text-[#8e918f] line-clamp-2">
                    {isSM
                      ? "Établir la relation fondamentale en rotation ou l'impédance RLC."
                      : "Établir l'équation différentielle en RC ou RL avec justifications."}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSend(
                      "Donne-moi la définition exacte d'une onde mécanique progressive selon le Cadre de Référence officiel du National."
                    )
                  }
                  className="p-4 rounded-2xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#3c4043] transition-all text-left flex flex-col justify-between group shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-xs font-semibold text-[#e3e3e3]">
                      Définition officielle
                    </span>
                    <div className="w-7 h-7 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xs text-[#8e918f] line-clamp-2">
                    Rappels stricts des définitions exigées par le Cadre de Référence officiel.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSend(
                      "Si Driss, pose-moi un piège classique posé récemment à l'Examen National en électricité ou mécanique !"
                    )
                  }
                  className="p-4 rounded-2xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#3c4043] transition-all text-left flex flex-col justify-between group shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-xs font-semibold text-[#e3e3e3]">
                      Pièges du National
                    </span>
                    <div className="w-7 h-7 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xs text-[#8e918f] line-clamp-2">
                    Testez vos réflexes sur les erreurs fatales qui font perdre des points.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsExercisePickerOpen(true)}
                  className="p-4 rounded-2xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#3c4043] transition-all text-left flex flex-col justify-between group shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-xs font-semibold text-[#e3e3e3]">
                      Résoudre un sujet type
                    </span>
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xs text-[#8e918f] line-clamp-2">
                    Choisir un exercice type du Bac (RC, RLC, Mécanique, Titrage) ou téléverser le vôtre.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Messages Stream */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1.5 ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {/* Message Header */}
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1 pl-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#f59e0b] flex items-center justify-center shadow-xs">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-[#e3e3e3]">Si Driss</span>
                  <span className="text-[10px] text-[#8e918f]">· {msg.timestamp}</span>
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`${
                  msg.role === 'user'
                    ? 'bg-[#282a2c] text-[#e3e3e3] rounded-3xl rounded-tr-md px-5 py-3 max-w-[85%] shadow-sm'
                    : 'w-full text-[#e3e3e3] pl-2 sm:pl-8 pr-2 space-y-2'
                }`}
              >
                {/* Render Attachments inside user message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="space-y-1.5 pb-2">
                    <div className="flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-2 rounded-xl flex items-center gap-2 text-xs bg-[#1e1f20] border border-[#3c4043] text-[#e3e3e3]"
                        >
                          {att.type === 'image' && att.previewUrl ? (
                            <div
                              onClick={() => setPreviewImageModal({ url: att.previewUrl!, name: att.name })}
                              className="relative cursor-pointer group flex items-center gap-2"
                            >
                              <img
                                src={att.previewUrl}
                                alt={att.name}
                                className="w-10 h-10 object-cover rounded-lg border border-white/10"
                              />
                              <span className="font-medium text-xs truncate max-w-[120px]">{att.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#8ab4f8]" />
                              <span className="font-medium text-xs truncate max-w-[140px]">{att.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Markdown and KaTeX content */}
                <MathView content={msg.content} className="text-sm leading-relaxed" />

                {/* Assistant Action Toolbar (Copy, TTS) */}
                {msg.role === 'assistant' && msg.id !== 'welcome' && (
                  <div className="flex items-center gap-2 pt-2 text-[#8e918f]">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="p-1.5 rounded-lg hover:bg-[#1e1f20] hover:text-[#e3e3e3] transition flex items-center gap-1 text-[11px]"
                      title="Copier la réponse"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => speakText(msg.content)}
                      className="p-1.5 rounded-lg hover:bg-[#1e1f20] hover:text-[#e3e3e3] transition flex items-center gap-1 text-[11px]"
                      title="Écouter l'explication (lecture vocale)"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Écouter</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-start gap-3 pl-1 animate-in fade-in">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#f59e0b] flex items-center justify-center shadow-xs">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#c4c7c5] pt-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8ab4f8]" />
                <span>Si Driss formule sa réponse selon le Cadre de Référence...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* FLOATING GEMINI PROMPT INPUT BAR */}
      <div className="sticky bottom-0 z-20 w-full px-3 sm:px-4 pb-3 pt-2 bg-gradient-to-t from-[#131314] via-[#131314]/95 to-transparent">
        <div className="max-w-3xl mx-auto">
          {/* Pending Attachments Pill Tray */}
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="px-2.5 py-1 rounded-full bg-[#1e1f20] border border-[#3c4043] text-xs text-[#e3e3e3] flex items-center gap-2 shrink-0 shadow-sm"
                >
                  <Paperclip className="w-3 h-3 text-[#8ab4f8]" />
                  <span className="truncate max-w-[140px] text-[11px] font-medium">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="text-[#8e918f] hover:text-rose-400 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Live Mathematical Preview if user wrote/inserted LaTeX */}
          {(input.includes('$') || input.includes('\\')) && (
            <div className="mb-2 px-3 py-1.5 rounded-2xl bg-[#1e1f20] border border-[#3c4043] text-xs flex items-center gap-2 overflow-x-auto text-[#e3e3e3] shadow-sm">
              <span className="text-[10px] font-semibold text-[#8ab4f8] shrink-0">Aperçu formule :</span>
              <div className="text-xs overflow-x-auto no-scrollbar py-0.5">
                <MathView content={input} />
              </div>
            </div>
          )}

          {/* Gemini Input Box */}
          <div className="bg-[#1e1f20] border border-[#3c4043]/80 focus-within:border-[#8ab4f8] focus-within:bg-[#202124] rounded-3xl p-3 shadow-xl transition-all">
            {/* Auto-expanding Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                pendingAttachments.length > 0
                  ? "Pose une question sur la pièce jointe..."
                  : socraticEnabled
                  ? "Demander à Si Driss (guidage socratique actif)..."
                  : "Demander à Si Driss (définition, formule, équation différentielle)..."
              }
              className="w-full bg-transparent text-sm text-[#e3e3e3] placeholder:text-[#8e918f] resize-none outline-none max-h-36 py-1 px-1 no-scrollbar"
            />

            {/* Bottom Controls Row inside input box */}
            <div className="flex items-center justify-between pt-2 border-t border-[#282a2c]/60">
              {/* Left Action Buttons (+, fx) */}
              <div className="flex items-center gap-1">
                {/* THE (+) ATTACHMENT BUTTON */}
                <div className="relative" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                    className="p-1.5 rounded-full hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white transition flex items-center justify-center"
                    title="Ajouter un document, une photo ou un exercice"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Add Popover Menu */}
                  {isAddMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#1e1f20] border border-[#3c4043] rounded-2xl shadow-2xl p-1.5 z-50 space-y-0.5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-left p-2 rounded-xl hover:bg-[#282a2c] text-[#e3e3e3] transition flex items-center gap-2.5"
                      >
                        <ImageIcon className="w-4 h-4 text-[#8ab4f8]" />
                        <div className="text-xs">
                          <div className="font-medium">Photo ou Document</div>
                          <div className="text-[10px] text-[#8e918f]">Énoncé, schéma ou PDF</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          setIsExercisePickerOpen(true);
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-[#282a2c] text-[#e3e3e3] transition flex items-center gap-2.5"
                      >
                        <GraduationCap className="w-4 h-4 text-amber-400" />
                        <div className="text-xs">
                          <div className="font-medium">Exercice type du Bac</div>
                          <div className="text-[10px] text-[#8e918f]">RC, RLC, Newton, Titrage...</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={handleInsertTemplate}
                        className="w-full text-left p-2 rounded-xl hover:bg-[#282a2c] text-[#e3e3e3] transition flex items-center gap-2.5"
                      >
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        <div className="text-xs">
                          <div className="font-medium">Gabarit structuré</div>
                          <div className="text-[10px] text-[#8e918f]">Énoncé, blocage, raisonnement</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          setIsDocPickerOpen(true);
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-[#282a2c] text-[#e3e3e3] transition flex items-center gap-2.5"
                      >
                        <BookOpen className="w-4 h-4 text-purple-400" />
                        <div className="text-xs">
                          <div className="font-medium">Documents officiels</div>
                          <div className="text-[10px] text-[#8e918f]">Cadres de référence /docs</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* THE (fx) QUICK FORMULA SHORTCUT BUTTON */}
                <div className="relative" ref={formulaMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsFormulaMenuOpen(!isFormulaMenuOpen)}
                    className={`px-2 py-1 rounded-full hover:bg-[#282a2c] transition flex items-center justify-center font-serif italic text-xs font-bold ${
                      isFormulaMenuOpen ? 'bg-[#282a2c] text-[#8ab4f8]' : 'text-[#8e918f] hover:text-[#e3e3e3]'
                    }`}
                    title="Insérer une formule mathématique du Bac"
                  >
                    ƒ(x)
                  </button>

                  {/* Formula Popover with Real MathView Rendering */}
                  {isFormulaMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 sm:w-96 bg-[#1e1f20] border border-[#3c4043] rounded-2xl shadow-2xl p-3 z-50 space-y-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between border-b border-[#282a2c] pb-1.5 px-1">
                        <span className="text-[11px] font-semibold text-[#c4c7c5] uppercase tracking-wider">
                          Formules du Bac 2BAC {branch}
                        </span>
                        <span className="text-[10px] text-[#8e918f]">
                          Cliquer pour insérer
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto no-scrollbar pr-0.5">
                        {(isSM ? QUICK_FORMULAS_SM : QUICK_FORMULAS_PC).map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => insertFormula(item.formula)}
                            className="p-2 rounded-xl bg-[#282a2c] hover:bg-[#323538] border border-[#3c4043]/60 hover:border-[#8ab4f8] text-left transition flex flex-col gap-1 group shadow-xs"
                            title={`Insérer : ${item.label}`}
                          >
                            <span className="text-[10px] font-semibold text-amber-300 truncate">
                              {item.label}
                            </span>
                            <div className="text-white text-xs py-0.5 overflow-x-auto no-scrollbar group-hover:text-[#8ab4f8] transition-colors">
                              <MathView content={`$${item.formula}$`} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Action Buttons (Socratic toggle, Send) */}
              <div className="flex items-center gap-2">
                {/* Socratic Mode Toggle Pill */}
                <button
                  type="button"
                  onClick={() => toggleSocratic(!socraticEnabled)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    socraticEnabled
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-[#282a2c] text-[#8e918f] hover:text-[#e3e3e3]'
                  }`}
                  title={
                    socraticEnabled
                      ? 'Mode Socratique : Si Driss pose des questions intermédiaires'
                      : 'Mode Direct : Réponse brute immédiate et formules'
                  }
                >
                  <Lightbulb className="w-3 h-3" />
                  <span className="text-[11px]">{socraticEnabled ? 'Socratique' : 'Direct'}</span>
                </button>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && pendingAttachments.length === 0) || loading}
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-950 flex items-center justify-center font-bold transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm shrink-0"
                  title="Envoyer la question"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quiet Cadre de référence disclaimer */}
          <p className="text-[11px] text-[#8e918f] text-center pt-2 select-none">
            Si Driss applique le Cadre de Référence officiel du Maroc (BIOF). Vérifie toujours tes résultats.
          </p>
        </div>
      </div>

      {/* Modals */}
      <ExercisePickerModal
        isOpen={isExercisePickerOpen}
        onClose={() => setIsExercisePickerOpen(false)}
        onSelectExercise={handleSelectExercise}
      />

      <DocumentPickerModal
        isOpen={isDocPickerOpen}
        onClose={() => setIsDocPickerOpen(false)}
        onSelectDoc={handleSelectDoc}
      />

      {/* Lightbox Image Preview Modal */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-[#282a2c] text-white hover:bg-[#3c4043] transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageModal.url}
              alt={previewImageModal.name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl border border-[#3c4043] shadow-2xl"
            />
            <span className="text-xs text-[#8e918f] mt-2 font-medium">{previewImageModal.name}</span>
          </div>
        </div>
      )}

      {/* Student API Key Configuration Modal */}
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
    </div>
  );
};
