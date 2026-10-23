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
  Save,
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
} from 'lucide-react';
import { MathView } from './MathView';
import { SessionManagerModal, SavedSession, ChatMessage, ChatAttachment } from './SessionManagerModal';
import { ExercisePickerModal } from './ExercisePickerModal';
import { DocumentPickerModal } from './DocumentPickerModal';
import { useApiKey } from '../hooks/useApiKey';
import { ApiKeyModal } from './ApiKeyModal';

interface SocraticChatProps {
  initialPrompt?: string;
  currentContext?: string;
}

const QUICK_FORMULAS = [
  '\\tau = RC',
  '\\tau = \\frac{L}{R_T}',
  'T_0 = 2\\pi\\sqrt{LC}',
  '\\sum \\vec{F}_{ext} = m \\vec{a}_G',
  'v_{lim} = \\frac{A}{B}',
  'm = \\frac{U_{max}-U_{min}}{U_{max}+U_{min}}',
  '\\theta = \\frac{\\lambda}{a}',
  't_{1/2} = \\frac{\\ln 2}{\\lambda}',
  'pH = pK_A + \\log\\frac{[A^-]}{[AH]}',
  'Q = I \\Delta t = n(e^-) F',
];

const SOCRATIC_STARTERS = [
  { label: 'Indice socratique', text: "Prof, je bloque sur l'établissement de l'équation différentielle. Peux-tu me guider avec une question intermédiaire ?" },
  { label: 'Vérifier mon référentiel', text: 'Si Driss, voici ma justification du référentiel pour la chute verticale : "Dans le référentiel terrestre supposé galiléen...". Est-ce complet pour le barème ?' },
  { label: 'Analyse dimensionnelle', text: 'Comment démontrer rigoureusement par analyse dimensionnelle que $[\tau] = T$ pour le dipôle RC et RL ?' },
  { label: 'Piège du National', text: "Pose-moi un piège classique posé récemment à l'Examen National en électricité ou mécanique !" },
];

const DIRECT_STARTERS = [
  { label: 'Définition : Onde progressive', text: "Donne-moi la définition exacte d'une onde mécanique progressive selon le Cadre de Référence officiel du National." },
  { label: 'Définition : Équivalence acido-basique', text: "Quelle est la définition officielle de l'équivalence acido-basique et sa relation stœchiométrique ?" },
  { label: 'Formule : Vitesse limite et constante tau', text: "Donne-moi directement l'expression de la vitesse limite v_lim et du temps caractéristique tau dans la chute avec frottement visqueux." },
  { label: 'Formule : Condition de bonne modulation AM', text: "Quelles sont les formules et conditions obligatoires pour une bonne modulation d'amplitude AM ?" },
];

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Salam aleykoum ! Bienvenue mon cher élève de 2ème Bac PC. Je suis **Si Driss**, ton professeur de Physique-Chimie.

Tu as maintenant le choix complet de ta méthode d'apprentissage :
- 💡 **Démarche Socratique ACTIVÉE** : Je te pose des questions intermédiaires ciblées pour te faire chercher et trouver toi-même la solution (idéal pour les exercices).
- ⚡ **Démarche Socratique DÉSACTIVÉE (Mode Direct)** : Si tu as besoin d'une **définition officielle** du Cadre de Référence, d'une **formule brute** avec ses unités, ou d'un rappel immédiat de cours.
- ➕ **Nouveau bouton "+" sur la barre des questions** : Tu peux désormais **joindre une photo ou un document d'exercice (PDF, image, énoncé)**, ou **sélectionner directement un exercice type du Bac** pour que je t'aide pas à pas !

*Tbarkellah 3lik*, pose ta question ou ajoute un exercice avec le bouton **+** ci-dessous !`,
  timestamp: 'Maintenant',
};

export const SocraticChat: React.FC<SocraticChatProps> = ({ initialPrompt, currentContext }) => {
  const [socraticEnabled, setSocraticEnabled] = useState<boolean>(true);
  const [coachingMode, setCoachingMode] = useState<'socratic' | 'direct' | 'review' | 'trap'>('socratic');

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

  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('Session en cours');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState<boolean>(false);

  // API Key management
  const { apiKey, hasApiKey, getAuthHeaders } = useApiKey();
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  // Attachments & modals state
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState<boolean>(false);
  const [isDocPickerOpen, setIsDocPickerOpen] = useState<boolean>(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

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
      const active = localStorage.getItem('sidriss_active_session_v1');
      if (active) {
        const parsed = JSON.parse(active);
        if (parsed.messages && parsed.messages.length > 0) {
          return parsed.messages;
        }
      }
    } catch {}
    return [DEFAULT_WELCOME_MSG];
  });

  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Close add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen]);

  // Initialize initial settings if saved
  useEffect(() => {
    try {
      const active = localStorage.getItem('sidriss_active_session_v1');
      if (active) {
        const parsed = JSON.parse(active);
        if (typeof parsed.socraticEnabled === 'boolean') setSocraticEnabled(parsed.socraticEnabled);
        if (parsed.coachingMode) setCoachingMode(parsed.coachingMode);
        if (parsed.title) setCurrentSessionTitle(parsed.title);
        if (parsed.updatedAt) {
          setLastSavedTime(
            new Date(parsed.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          );
        }
      }
    } catch {}
  }, []);

  // Auto-save current active session whenever messages or modes change
  useEffect(() => {
    if (messages.length === 0) return;
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
      setLastSavedTime(timeFormatted);
    } catch (e) {
      console.error('Failed to auto-save active session:', e);
    }
  }, [messages, socraticEnabled, coachingMode, currentSessionId, currentSessionTitle]);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
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

  const handleSaveSession = (customTitle?: string) => {
    const userMsg = messages.find((m) => m.role === 'user');
    const autoTitle = userMsg
      ? userMsg.content.slice(0, 45).replace(/\n/g, ' ')
      : `Session du ${new Date().toLocaleDateString('fr-FR')}`;

    const finalTitle = customTitle?.trim() || (currentSessionTitle !== 'Session en cours' ? currentSessionTitle : autoTitle);
    const nowIso = new Date().toISOString();

    const updatedSession: SavedSession = {
      id: currentSessionId,
      title: finalTitle,
      createdAt: nowIso,
      updatedAt: nowIso,
      messages,
      socraticEnabled,
      coachingMode,
    };

    const existingIdx = savedSessions.findIndex((s) => s.id === currentSessionId);
    let updatedList: SavedSession[];
    if (existingIdx >= 0) {
      updatedList = [...savedSessions];
      updatedList[existingIdx] = updatedSession;
    } else {
      updatedList = [updatedSession, ...savedSessions];
    }

    setSavedSessions(updatedList);
    setCurrentSessionTitle(finalTitle);
    try {
      localStorage.setItem('sidriss_saved_sessions_v1', JSON.stringify(updatedList));
    } catch (e) {
      console.error('Failed to save sessions list:', e);
    }

    setSaveToast(`Session "${finalTitle}" sauvegardée !`);
    setTimeout(() => setSaveToast(null), 3000);
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
    setCurrentSessionTitle('Nouvelle session');
    setMessages([DEFAULT_WELCOME_MSG]);
    setPendingAttachments([]);
    try {
      localStorage.removeItem('sidriss_active_session_v1');
    } catch {}

    setSaveToast('Nouvelle session démarrée');
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleLoadSession = (session: SavedSession) => {
    setCurrentSessionId(session.id);
    setCurrentSessionTitle(session.title);
    setMessages(session.messages);
    setSocraticEnabled(session.socraticEnabled);
    setCoachingMode(session.coachingMode);
    setPendingAttachments([]);
    setSaveToast(`Session "${session.title}" chargée`);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleDeleteSession = (id: string) => {
    const updated = savedSessions.filter((s) => s.id !== id);
    setSavedSessions(updated);
    try {
      localStorage.setItem('sidriss_saved_sessions_v1', JSON.stringify(updated));
    } catch {}
  };

  const handleImportSessions = (imported: SavedSession[]) => {
    const existingIds = new Set(savedSessions.map((s) => s.id));
    const newOnes = imported.filter((s) => !existingIds.has(s.id));
    const updated = [...newOnes, ...savedSessions];
    setSavedSessions(updated);
    try {
      localStorage.setItem('sidriss_saved_sessions_v1', JSON.stringify(updated));
    } catch {}
  };

  // File upload handler (Images, PDFs, Text documents)
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
        // Plain text / Markdown
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
    const template = `📚 **Exercice :** [Précise le chapitre : RC, RLC, Newton, Titrage, Radioactivité, Ondes...]
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

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setPendingAttachments([]);
    setIsAddMenuOpen(false);
    setLoading(true);

    const assistantMsgId = String(Date.now() + 1);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s safety timeout

    try {
      // Stream endpoint with attachments payload & student API key header
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
              } catch {
                // partial chunk, continue
              }
            }
          }
        }

        // Fallback to standard endpoint if stream returned nothing
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
        // Direct fallback to standard /api/chat
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
            ? "⏱️ **Temps d'attente dépassé** : La réponse a pris un peu trop de temps. Clique sur le bouton d'envoi pour réessayer, ou reformule ta question brièvement, lah yerdi 3lik !"
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
    setInput((prev) => `${prev} $${formula}$ `);
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

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
      {/* Toast Notification */}
      {saveToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-lg flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,application/pdf,.txt,.md"
        multiple
        className="hidden"
      />

      {/* Header Bar */}
      <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Identity and Session Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg text-sm shrink-0">
            SD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Si Driss
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Professeur PC 2BAC
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="truncate max-w-[180px] sm:max-w-xs text-slate-300 font-medium">
                {currentSessionTitle}
              </span>
              {lastSavedTime && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 text-[10px] font-mono">
                    Auto-sauvegardé {lastSavedTime}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Socratic Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl shadow-inner text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1 text-[11px]">
              {socraticEnabled ? (
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>Socratique :</span>
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={socraticEnabled}
              onClick={() => toggleSocratic(!socraticEnabled)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                socraticEnabled ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-md ring-0 transition duration-200 ease-in-out ${
                  socraticEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Quick Save Button */}
          <button
            onClick={() => handleSaveSession()}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-400 hover:text-amber-300 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
            title="Enregistrer cette session dans votre historique"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sauvegarder</span>
          </button>

          {/* Sessions & Backup Modal Trigger */}
          <button
            onClick={() => setIsSessionModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
            title="Historique des sessions, export et restauration de backup"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Historique & Sauvegardes</span>
            {savedSessions.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {savedSessions.length}
              </span>
            )}
          </button>

          {/* New Chat Button */}
          <button
            onClick={() => {
              if (messages.length > 1) {
                if (confirm('Commencer une nouvelle session ? La session en cours sera archivée dans vos sauvegardes.')) {
                  handleNewSession();
                }
              } else {
                handleNewSession();
              }
            }}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all"
            title="Nouveau chat (Réinitialiser)"
          >
            <Plus className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Socratic Mode Banner Explainer */}
      <div
        className={`px-4 py-2 border-b flex items-center justify-between text-xs transition-colors ${
          socraticEnabled
            ? 'bg-amber-950/30 border-amber-500/20 text-amber-200'
            : 'bg-cyan-950/30 border-cyan-500/20 text-cyan-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {socraticEnabled ? (
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span>
            {socraticEnabled ? (
              <>
                <strong>Démarche Socratique ACTIVÉE :</strong> Si Driss te guide avec des questions pour te faire déduire la démarche scientifique.
              </>
            ) : (
              <>
                <strong>Mode Direct ACTIVÉ :</strong> Si Driss donne directement la formule brute, la définition officielle et le barème sans questions intermédiaires.
              </>
            )}
          </span>
        </div>

        <button
          onClick={() => toggleSocratic(!socraticEnabled)}
          className="text-[11px] underline font-semibold hover:opacity-80 shrink-0 ml-2"
        >
          {socraticEnabled ? 'Passer en direct' : 'Réactiver guidage socratique'}
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            {msg.role === 'assistant' ? (
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0 mt-1">
                SD
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-1">
                Bac
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm space-y-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-100 rounded-tl-none'
              }`}
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-700/40 pb-1.5 text-[11px] opacity-80">
                <span className="font-semibold">
                  {msg.role === 'assistant' ? 'Si Driss (Prof)' : 'Ta question / réponse'}
                </span>
                <div className="flex items-center gap-2">
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => speakText(msg.content)}
                      className="hover:text-amber-400 transition-colors p-0.5"
                      title="Écouter l'explication"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Render Attached Documents/Images inside the user's message */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="space-y-2 pt-1 pb-2">
                  <div className="text-[11px] font-bold opacity-90 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Documents & Exercices joints ({msg.attachments.length}) :</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className={`p-2 rounded-xl flex items-center gap-2 text-xs border ${
                          msg.role === 'user'
                            ? 'bg-blue-700/70 border-blue-500/50 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-200'
                        }`}
                      >
                        {att.type === 'image' && att.previewUrl ? (
                          <div
                            onClick={() => setPreviewImageModal({ url: att.previewUrl!, name: att.name })}
                            className="relative cursor-pointer group flex items-center gap-2"
                          >
                            <img
                              src={att.previewUrl}
                              alt={att.name}
                              className="w-12 h-12 object-cover rounded-lg border border-white/20 group-hover:opacity-80 transition-opacity"
                            />
                            <div className="text-[11px] max-w-[140px] truncate">
                              <span className="font-semibold block truncate">{att.name}</span>
                              <span className="opacity-75 flex items-center gap-1 text-[10px]">
                                <Eye className="w-3 h-3" /> Agrandir
                              </span>
                            </div>
                          </div>
                        ) : att.type === 'exercise' ? (
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <div className="text-[11px] max-w-[200px]">
                              <span className="font-bold block truncate">{att.name}</span>
                              {att.chapter && (
                                <span className="text-[10px] opacity-80">{att.chapter}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="text-[11px] max-w-[180px]">
                              <span className="font-bold block truncate">{att.name}</span>
                              {att.size && (
                                <span className="text-[10px] opacity-80">
                                  {(att.size / 1024).toFixed(1)} Ko
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <MathView content={msg.content} className="text-sm leading-relaxed" />
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">
              SD
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-2 text-xs text-amber-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>
                {socraticEnabled
                  ? 'Si Driss analyse tes données et prépare la question directrice...'
                  : 'Si Driss rédige la réponse complète et la définition officielle...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Starters chips */}
      <div className="px-4 py-2 bg-slate-950/70 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold shrink-0">
          {socraticEnabled ? 'Guidage :' : 'Définitions & Formules :'}
        </span>
        {(socraticEnabled ? SOCRATIC_STARTERS : DIRECT_STARTERS).map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(s.text)}
            className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs shrink-0 transition-all flex items-center gap-1.5"
          >
            {socraticEnabled ? (
              <Sparkles className="w-3 h-3 text-amber-400" />
            ) : (
              <Zap className="w-3 h-3 text-cyan-400" />
            )}
            {s.label}
          </button>
        ))}
      </div>

      {/* KaTeX Formula Shortcut Bar */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-xs text-slate-400 font-semibold shrink-0">Formules :</span>
        {QUICK_FORMULAS.map((f, i) => (
          <button
            key={i}
            onClick={() => insertFormula(f)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/80 text-sky-300 hover:text-amber-300 transition-all shrink-0 flex items-center shadow-sm"
            title="Cliquer pour insérer dans le message"
          >
            <MathView content={`$${f}$`} className="inline" />
          </button>
        ))}
      </div>

      {/* Pending Attachments Tray (Directly above the question input bar) */}
      {pendingAttachments.length > 0 && (
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-amber-400 font-bold shrink-0 flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5" />
            <span>À envoyer ({pendingAttachments.length}) :</span>
          </span>

          {pendingAttachments.map((att) => (
            <div
              key={att.id}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200 flex items-center gap-2 shrink-0 shadow-sm"
            >
              {att.type === 'image' && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="w-6 h-6 object-cover rounded border border-slate-700"
                />
              ) : att.type === 'exercise' ? (
                <GraduationCap className="w-4 h-4 text-amber-400" />
              ) : (
                <FileText className="w-4 h-4 text-cyan-400" />
              )}
              <span className="font-semibold text-xs max-w-[160px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="p-0.5 text-slate-400 hover:text-red-400 transition-colors"
                title="Supprimer la pièce jointe"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPendingAttachments([])}
            className="text-[11px] text-slate-500 hover:text-slate-300 underline ml-auto shrink-0"
          >
            Tout effacer
          </button>
        </div>
      )}

      {/* API Key Banner if missing */}
      {!hasApiKey && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900 border-t border-amber-500/30 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <Key className="w-4 h-4 shrink-0 text-amber-400" />
            <span><strong>Clé API requise :</strong> Ajoute ta clé gratuite Google AI Studio pour discuter avec Si Driss.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsApiKeyModalOpen(true)}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition shadow"
          >
            Configurer ma clé
          </button>
        </div>
      )}

      {/* Main Question Input Bar */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* THE PLUS (+) BUTTON FOR ADDING DOCUMENTS OR EXERCISES */}
          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 shadow-sm ${
                isAddMenuOpen || pendingAttachments.length > 0
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                  : 'bg-slate-900 border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-850 text-amber-400 hover:text-amber-300'
              }`}
              title="Ajouter un document, une photo ou un exercice (+)"
              aria-label="Ajouter un document ou un exercice"
            >
              <Plus
                className={`w-4 h-4 transition-transform duration-200 ${
                  isAddMenuOpen ? 'rotate-45' : ''
                }`}
              />
            </button>

            {/* Popover Menu Triggered by (+) Button */}
            {isAddMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-2 z-40 space-y-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Ajouter à ma question
                </div>

                {/* 1. Upload Document or Photo */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 text-slate-200 transition-colors flex items-start gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition-colors shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Téléverser une Photo ou un Fichier
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Photo d'énoncé, schéma, graphe ou PDF (analyse d'image par l'IA)
                    </p>
                  </div>
                </button>

                {/* 2. Choose Bac Exercise */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setIsExercisePickerOpen(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 text-slate-200 transition-colors flex items-start gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Exercice Type du Bac (2BAC PC & SM)
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Sujets officiels du National (RC, RLC, Newton, Titrage, Ondes...)
                    </p>
                  </div>
                </button>

                {/* 3. Insert Structured Template */}
                <button
                  type="button"
                  onClick={handleInsertTemplate}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 text-slate-200 transition-colors flex items-start gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shrink-0">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Gabarit d'Exercice Structuré
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Insère le modèle : Énoncé, Données, Blocage, Mon début
                    </p>
                  </div>
                </button>

                {/* 4. Official Programme Document */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setIsDocPickerOpen(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 text-slate-200 transition-colors flex items-start gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Documents du Programme (/docs/programme/)
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Cadres de référence, cours et fiches du programme marocain
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingAttachments.length > 0
                ? "Ajoute une question sur la pièce jointe ou appuie sur Entrée pour envoyer..."
                : !socraticEnabled
                ? "Mode Direct : demande une définition officielle, une formule, un cours..."
                : coachingMode === 'socratic'
                ? "Pose ta question, ou clique sur (+) pour ajouter un exercice ou document..."
                : coachingMode === 'review'
                ? "Colle ta rédaction complète pour l'auditer selon le barème du National..."
                : "Demande un piège du National ou résous une énigme..."
            }
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={(!input.trim() && pendingAttachments.length === 0) || loading}
            className={`p-2.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md ${
              socraticEnabled
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950'
            }`}
            title="Envoyer la question à Si Driss"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        isOpen={isExercisePickerOpen}
        onClose={() => setIsExercisePickerOpen(false)}
        onSelectExercise={handleSelectExercise}
      />

      {/* Document Picker Modal */}
      <DocumentPickerModal
        isOpen={isDocPickerOpen}
        onClose={() => setIsDocPickerOpen(false)}
        onSelectDoc={handleSelectDoc}
      />

      {/* Session Manager & Backup Modal */}
      <SessionManagerModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        currentMessages={messages}
        socraticEnabled={socraticEnabled}
        coachingMode={coachingMode}
        savedSessions={savedSessions}
        currentSessionId={currentSessionId}
        onLoadSession={handleLoadSession}
        onSaveCurrentSession={handleSaveSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onImportSessions={handleImportSessions}
      />

      {/* Lightbox Image Preview Modal */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageModal.url}
              alt={previewImageModal.name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl border border-slate-700 shadow-2xl"
            />
            <span className="text-xs text-slate-300 mt-2 font-semibold">
              {previewImageModal.name}
            </span>
          </div>
        </div>
      )}

      {/* Student API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
};
