/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, 
  Flex, 
  VStack, 
  HStack, 
  Text, 
  IconButton, 
  Button, 
  Textarea, 
  Tooltip, 
  Skeleton, 
  SkeletonText,
  Spacer,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  Progress,
  useToast,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Input,
  InputGroup,
  InputRightElement,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Portal,
  Switch,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Grid,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  Select,
  InputLeftElement,
  useBreakpointValue
} from '@chakra-ui/react';
import { 
  Sparkles, 
  Send, 
  Code, 
  Eye, 
  RotateCcw, 
  Copy, 
  Check, 
  Terminal, 
  Layout, 
  Zap,
  BrainCircuit,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
  Trash2,
  Settings,
  History,
  Box as BoxIcon,
  Globe,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Search,
  Key,
  EyeOff,
  FileJson,
  Download,
  Plus,
  Minus,
  Cloud,
  SaveAll,
  FileCode,
  Info,
  Copy as CopyIcon,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  ArrowUp,
  FileCode2,
  Star,
  Edit3,
  LogOut,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Editor, { OnMount } from '@monaco-editor/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import { ModelType, ChatMessage } from './lib/gemini';
import { useStore, Version, Project, AIProvider } from './store/useStore';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, addDoc } from 'firebase/firestore';

const PRESET_PROVIDERS = [
  { 
    name: 'OpenRouter', 
    baseUrl: 'https://openrouter.ai/api/v1', 
    apiKeyUrl: 'https://openrouter.ai/workspaces/default/keys',
    docsUrl: 'https://openrouter.ai/docs'
  },
  { 
    name: 'Pollinations', 
    baseUrl: 'https://gen.pollinations.ai/v1', 
    apiKeyUrl: 'https://enter.pollinations.ai/sign-in',
    docsUrl: 'https://pollinations.ai'
  },
  { 
    name: 'KiloCode', 
    baseUrl: 'https://api.kilo.ai/api/gateway', 
    apiKeyUrl: 'https://app.kilo.ai/profile',
    docsUrl: 'https://kilo.ai'
  },
  { 
    name: 'OpenCode', 
    baseUrl: 'https://opencode.ai/zen/v1', 
    apiKeyUrl: 'https://opencode.ai/workspace/wrk_01KE8YNHE01D9HYD496WY3S4ZM/keys',
    docsUrl: 'https://opencode.ai'
  },
  { 
    name: 'Puter', 
    baseUrl: 'https://api.puter.com/puterai/openai/v1', 
    apiKeyUrl: 'https://puter.com/dashboard#account',
    docsUrl: 'https://puter.com/docs'
  },
  { 
    name: 'OpenAI', 
    baseUrl: 'https://api.openai.com/v1', 
    apiKeyUrl: 'https://platform.openai.com/settings/organization/api-keys',
    docsUrl: 'https://platform.openai.com/docs'
  },
  { 
    name: 'Anthropic', 
    baseUrl: 'https://anthropic.com', 
    apiKeyUrl: 'https://platform.claude.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com'
  },
];

export default function App() {
  const {
    html,
    userInput,
    isLoading,
    messages,
    model,
    isThinking,
    previewMode,
    activeTab,
    error,
    history: undoHistory,
    historyIndex,
    savedProjects,
    currentProjectId,
    generationMode,
    versions,
    settings,
    searchQuery,
    availableModels,
    setUserInput,
    setModel,
    setIsThinking,
    setPreviewMode,
    setActiveTab,
    setError,
    clearChat,
    executeAiAction,
    retryLastAction,
    undo,
    redo,
    saveProject,
    saveProjectAs,
    loadProject,
    deleteProject,
    setGenerationMode,
    updateSettings,
    revertToVersion,
    setHtml,
    setSearchQuery,
    providerSearchQuery,
    setProviderSearchQuery,
    fetchModels,
    generateImageAction,
    syncProject,
    stopSync,
    copyProject,
    addProvider,
    updateProvider,
    removeProvider,
    toggleFavoriteModel,
    addManualModel,
    optimizeCode,
    clearChatAndSave,
    modelSearchQuery,
    setModelSearchQuery,
    lastSavedHtml,
    lastAutoSaveTime,
    isSaving,
    isFetchingModels,
    isGeneratingImage: isGeneratingImageStore
  } = useStore();

  const [user] = useAuthState(auth);
  const [copied, setCopied] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [newProvider, setNewProvider] = useState<{ name: string; apiKey: string; baseUrl: string; manualModels: { name: string; displayName: string }[] }>({ 
    name: '', 
    apiKey: '', 
    baseUrl: '', 
    manualModels: [] 
  });
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [saveAsName, setSaveAsName] = useState('');
  const [manualModelId, setManualModelId] = useState('');
  const [manualModelName, setManualModelName] = useState('');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowCookieConsent(true);
    }
  }, []);

  const handleCookieConsent = (accepted: boolean) => {
    localStorage.setItem('cookie-consent', accepted ? 'accepted' : 'rejected');
    setShowCookieConsent(false);
    toast({
      title: accepted ? "Cookies accepted" : "Cookies rejected",
      status: accepted ? "success" : "info",
      duration: 2000,
    });
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const toast = useToast();
  
  const isDirty = html !== lastSavedHtml;
  
  const { isOpen: isSaveOpen, onOpen: onSaveOpen, onClose: onSaveClose } = useDisclosure();
  const { isOpen: isSaveAsOpen, onOpen: onSaveAsOpen, onClose: onSaveAsClose } = useDisclosure();
  const { isOpen: isLoadOpen, onOpen: onLoadOpen, onClose: onLoadClose } = useDisclosure();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const { isOpen: isVersionsOpen, onOpen: onVersionsOpen, onClose: onVersionsClose } = useDisclosure();
  const { isOpen: isWhatsNewOpen, onOpen: onWhatsNewOpen, onClose: onWhatsNewClose } = useDisclosure();
  const { isOpen: isImageOpen, onOpen: onImageOpen, onClose: onImageClose } = useDisclosure();
  const { isOpen: isProviderDetailOpen, onOpen: onProviderDetailOpen, onClose: onProviderDetailClose } = useDisclosure();

  // Auto-save effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (html) {
        saveProject(projectName || 'Auto-saved Project', true);
      }
    }, 120000); // Every 2 minutes
    return () => clearInterval(interval);
  }, [html, projectName, saveProject]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleReloadPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
  };

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        window.requestAnimationFrame(() => {
          const newWidth = mouseMoveEvent.clientX;
          if (newWidth > 250 && newWidth < 800) {
            setSidebarWidth(newWidth);
          }
        });
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    await generateImageAction(imagePrompt);
    setImagePrompt('');
    onImageClose();
  };

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Define custom theme
    monaco.editor.defineTheme('gemini-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'identifier', foreground: '50fa7b' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'tag', foreground: 'ff79c6' },
        { token: 'attribute.name', foreground: '50fa7b' },
        { token: 'attribute.value', foreground: 'f1fa8c' },
      ],
      colors: {
        'editor.background': '#1a1a24',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#2a2a35',
        'editorCursor.foreground': '#aeafad',
        'editorWhitespace.foreground': '#404040',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
      }
    });
    monaco.editor.setTheme('gemini-dark');

    // Configure validation
    monaco.languages.html.htmlDefaults.setOptions({
      format: {
        tabSize: 2,
        insertSpaces: true,
      },
      suggest: {
        html5: true,
      },
      validate: true
    });

    monaco.languages.css.cssDefaults.setOptions({
      validate: true,
      lint: {
        compatibleVendorPrefixes: 'warning',
        vendorPrefix: 'warning',
        duplicateProperties: 'warning',
        emptyRules: 'warning',
        importStatement: 'warning',
        boxModel: 'warning',
        universalSelector: 'warning',
        zeroUnits: 'warning',
        fontFaceDeclaration: 'warning',
        argumentsInColorFunction: 'error',
        unknownProperties: 'warning',
        ieHack: 'warning',
        unknownVendorSpecificProperties: 'warning',
        propertyIgnoredDueToDisplay: 'warning',
        important: 'warning',
        float: 'warning',
        idSelector: 'warning',
      }
    });

    // Add Keyboard Shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveProject(projectName || 'Untitled Project');
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      const currentWrap = settings.wordWrap;
      updateSettings({ wordWrap: currentWrap === 'on' ? 'off' : 'on' });
    });

    // Add custom autocompletion
    const htmlProvider = monaco.languages.registerCompletionItemProvider('html', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        
        const suggestions = [
          // CDN Snippets
          {
            label: 'tailwind-cdn',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<script src="https://cdn.tailwindcss.com"></script>',
            documentation: 'Tailwind CSS CDN script',
            range: range,
          },
          {
            label: 'lucide-icons',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<script src="https://unpkg.com/lucide@latest"></script>\n<script>\n  lucide.createIcons();\n</script>',
            documentation: 'Lucide Icons CDN and initialization',
            range: range,
          },
          {
            label: 'google-fonts',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">',
            documentation: 'Google Fonts (Inter) import',
            range: range,
          },
          {
            label: 'font-awesome',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">',
            documentation: 'Font Awesome CDN',
            range: range,
          },
          // Layout Snippets
          {
            label: 'flex-center',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class="flex items-center justify-center"',
            documentation: 'Tailwind flex center classes',
            range: range,
          },
          {
            label: 'flex-col-center',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class="flex flex-col items-center justify-center"',
            documentation: 'Tailwind flex column center classes',
            range: range,
          },
          {
            label: 'grid-auto',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"',
            documentation: 'Responsive Tailwind grid',
            range: range,
          },
          {
            label: 'container-center',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"',
            documentation: 'Centered container with padding',
            range: range,
          },
          {
            label: 'section-padding',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class="py-12 md:py-24"',
            documentation: 'Responsive section padding',
            range: range,
          },
          // Component Snippets
          {
            label: 'button-primary',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<button class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/30">\n  ${1:Button Text}\n</button>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Primary Tailwind button with effects',
            range: range,
          },
          {
            label: 'button-secondary',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<button class="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95">\n  ${1:Button Text}\n</button>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Secondary Tailwind button',
            range: range,
          },
          {
            label: 'card-basic',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-shadow duration-300">\n  <div class="p-8">\n    <h3 class="text-xl font-bold text-gray-900 dark:text-white">${1:Card Title}</h3>\n    <p class="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">${2:Card content goes here...}</p>\n  </div>\n</div>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Modern Tailwind card',
            range: range,
          },
          {
            label: 'input-field',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<div class="space-y-2">\n  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">${1:Label}</label>\n  <input type="${2:text}" class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="${3:Placeholder}">\n</div>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Styled input field',
            range: range,
          },
          // JS Snippets
          {
            label: 'fetch-api',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'fetch(\'${1:url}\')\n  .then(res => res.json())\n  .then(data => {\n    console.log(data);\n    ${2}\n  })\n  .catch(err => console.error(err));',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Fetch API snippet',
            range: range,
          },
          {
            label: 'event-listener',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'document.getElementById(\'${1:id}\').addEventListener(\'${2:click}\', (e) => {\n  ${3}\n});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Add event listener',
            range: range,
          },
          {
            label: 'query-selector',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'const ${1:el} = document.querySelector(\'${2:.selector}\');',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Query selector',
            range: range,
          }
        ];
        
        return { suggestions: suggestions };
      }
    });

    const cssProvider = monaco.languages.registerCompletionItemProvider('css', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        
        const suggestions = [
          {
            label: 'glassmorphism',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'background: rgba(255, 255, 255, 0.1);\nbackdrop-filter: blur(10px);\nborder: 1px solid rgba(255, 255, 255, 0.1);\nborder-radius: 16px;',
            documentation: 'Glassmorphism effect',
            range: range,
          },
          {
            label: 'flex-center-css',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'display: flex;\nalign-items: center;\njustify-content: center;',
            documentation: 'Flex center CSS',
            range: range,
          },
          {
            label: 'absolute-center',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'position: absolute;\ntop: 50%;\nleft: 50%;\ntransform: translate(-50%, -50%);',
            documentation: 'Absolute center CSS',
            range: range,
          }
        ];
        
        return { suggestions: suggestions };
      }
    });

    const jsProvider = monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        
        const suggestions = [
          {
            label: 'clog',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'console.log(${1:data});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Console log',
            range: range,
          },
          {
            label: 'async-function',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'async function ${1:name}(${2:params}) {\n  try {\n    ${3}\n  } catch (error) {\n    console.error(error);\n  }\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Async function with try/catch',
            range: range,
          }
        ];
        
        return { suggestions: suggestions };
      }
    });

    // Store providers to dispose them if needed
    (window as any)._monacoProviders = [htmlProvider, cssProvider, jsProvider];
  };

  useEffect(() => {
    if (currentProjectId) {
      syncProject(currentProjectId);
    } else {
      stopSync();
    }
    return () => stopSync();
  }, [currentProjectId, syncProject, stopSync]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    chatContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredMessages = messages.filter(msg => 
    msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

  const handleSend = async () => {
    if (!userInput.trim() || isLoading) return;
    const prompt = userInput;
    setUserInput('');
    
    const userMsg: ChatMessage = { role: 'user', content: prompt };
    useStore.getState().addMessage(userMsg);

    // Sync user message to Firestore
    if (currentProjectId && auth.currentUser) {
      const messageRef = collection(db, 'projects', currentProjectId, 'messages');
      await addDoc(messageRef, { ...userMsg, timestamp: Date.now() });
    }

    await executeAiAction(prompt);
  };

  const handleRefactor = async () => {
    if (!html || isLoading) return;
    const prompt = "Refactor this code to follow modern best practices.";
    const userMsg: ChatMessage = { role: 'user', content: prompt };
    useStore.getState().addMessage(userMsg);

    // Sync user message to Firestore
    if (currentProjectId && auth.currentUser) {
      const messageRef = collection(db, 'projects', currentProjectId, 'messages');
      await addDoc(messageRef, { ...userMsg, timestamp: Date.now() });
    }

    await executeAiAction("Refactor this code to follow modern best practices while preserving all functionality.");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    toast({
      title: "Code copied.",
      status: "success",
      duration: 2000,
      isClosable: true,
      position: 'top'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportHtml = () => {
    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, `${projectName || 'project'}.html`);
    toast({
      title: "Project exported as HTML",
      status: "success",
      duration: 2000,
    });
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    zip.file("index.html", html);
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${projectName || 'project'}.zip`);
    toast({
      title: "Project exported as ZIP",
      status: "success",
      duration: 2000,
    });
  };

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.apiKey) return;
    await addProvider({
      name: newProvider.name,
      apiKey: newProvider.apiKey,
      baseUrl: newProvider.baseUrl,
      manualModels: newProvider.manualModels
    });
    setNewProvider({ name: '', apiKey: '', baseUrl: '', manualModels: [] });
    setShowAddProvider(false);
    toast({
      title: "Provider Added",
      description: "Available models have been fetched automatically.",
      status: "success",
      duration: 3000,
    });
  };

  const handleUpdateProvider = async () => {
    if (!editingProviderId || !newProvider.name || !newProvider.apiKey) return;
    updateProvider(editingProviderId, {
      name: newProvider.name,
      apiKey: newProvider.apiKey,
      baseUrl: newProvider.baseUrl,
      manualModels: newProvider.manualModels
    });
    setEditingProviderId(null);
    setNewProvider({ name: '', apiKey: '', baseUrl: '', manualModels: [] });
    toast({
      title: "Provider Updated",
      status: "success",
      duration: 2000,
    });
  };

  const startEditingProvider = (provider: AIProvider) => {
    setEditingProviderId(provider.id);
    setNewProvider({
      name: provider.name,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || '',
      manualModels: provider.manualModels || []
    });
    setShowAddProvider(true);
  };

  const handleTestConnection = async (providerId: string) => {
    try {
      await fetchModels(providerId);
      toast({
        title: "Connection Successful",
        description: "Models fetched successfully.",
        status: "success",
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: "Connection Failed",
        description: err.message || "Could not connect to provider.",
        status: "error",
        duration: 5000,
      });
    }
  };

  const handleTestKey = async () => {
    try {
      await fetchModels();
      toast({
        title: "Connection Successful",
        description: "Successfully connected to the provider and fetched models.",
        status: "success",
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: "Connection Failed",
        description: err.message || "Could not connect to the provider.",
        status: "error",
        duration: 3000,
      });
    }
  };

  const filteredProjects = savedProjects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.html.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = () => {
    if (!projectName.trim()) return;
    saveProject(projectName);
    onSaveClose();
    toast({
      title: "Project saved.",
      status: "success",
      duration: 2000,
      position: 'top'
    });
  };

  const handleSaveAs = () => {
    if (!saveAsName.trim()) return;
    saveProjectAs(saveAsName);
    onSaveAsClose();
    toast({
      title: "Project saved as new copy.",
      status: "success",
      duration: 2000,
      position: 'top'
    });
  };

  const handleAddManualModel = (providerId: string) => {
    if (!manualModelId.trim() || !manualModelName.trim()) return;
    addManualModel(providerId, manualModelId, manualModelName);
    setManualModelId('');
    setManualModelName('');
    toast({
      title: "Model added manually",
      status: "success",
      duration: 2000,
    });
  };

  const getIframeWidth = () => {
    switch (previewMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  };

  const filteredProviders = (settings.providers || []).filter(p => 
    p.name.toLowerCase().includes(providerSearchQuery.toLowerCase())
  );

  const activeProvider = (settings.providers || []).find(p => p.id === settings.activeProviderId);
  const currentAvailableModels = activeProvider?.availableModels || [];

  const isFreeModel = (m: any) => {
    const name = (m.displayName || m.name || '').toLowerCase();
    return name.includes('free') || m.inputTokenPrice === 0 || m.outputTokenPrice === 0;
  };

  const filteredModels = currentAvailableModels.filter(m => {
    const matchesSearch = (m.displayName || m.name || '').toLowerCase().includes(modelSearchQuery.toLowerCase());
    const matchesFree = !settings.showFreeOnly || isFreeModel(m);
    return matchesSearch && matchesFree;
  });

  const allFilteredModels = (settings.providers || []).flatMap(p => 
    (p.availableModels || []).map(m => ({ ...m, providerName: p.name, providerId: p.id }))
  ).filter(m => {
    const matchesSearch = (m.displayName || m.name || '').toLowerCase().includes(modelSearchQuery.toLowerCase());
    const matchesFree = !settings.showFreeOnly || isFreeModel(m);
    return matchesSearch && matchesFree;
  });

  const EXAMPLE_CATEGORIES = [
    {
      name: 'Layouts & Pages',
      examples: [
        { name: 'Landing Page', prompt: 'Generate a modern landing page for a SaaS product with hero, features, and pricing.', icon: <Layout size={14} /> },
        { name: 'Dashboard', prompt: 'Generate a clean admin dashboard with sidebar, stats cards, and a data table.', icon: <BoxIcon size={14} /> },
        { name: 'Portfolio', prompt: 'Generate a creative portfolio for a designer with project grid and contact form.', icon: <Globe size={14} /> },
      ]
    },
    {
      name: 'Components',
      examples: [
        { name: 'Navbar', prompt: 'Generate a responsive navigation bar with logo, links, and a call-to-action button.', icon: <Layout size={14} /> },
        { name: 'Pricing Table', prompt: 'Generate a responsive pricing table with three tiers and hover effects.', icon: <Zap size={14} /> },
        { name: 'Contact Form', prompt: 'Generate a modern contact form with validation and success state.', icon: <Send size={14} /> },
      ]
    }
  ];

  return (
    <Flex 
      h="100vh" 
      bg="#0a0a0c" 
      color="slate.200" 
      overflow="hidden" 
      position="relative"
      direction={isMobile ? "column" : "row"}
    >
      {/* Sidebar / Chat Panel */}
      <Box 
        w={isMobile ? "full" : (isSidebarMinimized ? "0px" : `${sidebarWidth}px`)}
        h={isMobile ? "45%" : "full"}
        minW={isMobile ? "full" : (isSidebarMinimized ? "0px" : "250px")}
        display="flex" 
        flexDirection="column" 
        borderRight={isMobile ? "none" : (isSidebarMinimized ? "none" : "1px solid")}
        borderBottom={isMobile ? "1px solid" : "none"}
        borderColor="whiteAlpha.100" 
        bg="#0d0d11"
        position="relative"
        transition={isResizing ? "none" : "width 0.3s ease-in-out"}
        overflow={isSidebarMinimized ? "hidden" : "visible"}
        zIndex={15}
      >
        <Flex p={4} align="center" justify="space-between" borderBottom="1px solid" borderColor="whiteAlpha.100" minH="65px">
          <Menu>
            <MenuButton
              as={Box}
              cursor="pointer"
              _hover={{ opacity: 0.8 }}
              transition="opacity 0.2s"
            >
              <HStack spacing={3}>
                <Box 
                  w={8} h={8} 
                  borderRadius="lg" 
                  bgGradient="linear(to-br, blue.500, purple.600)" 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center" 
                  boxShadow="0 0 15px rgba(66, 153, 225, 0.3)"
                >
                  <Sparkles size={18} color="white" />
                </Box>
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="bold">AI Gen</Text>
                </VStack>
              </HStack>
            </MenuButton>
            <Portal>
              <MenuList bg="#1a1a24" borderColor="whiteAlpha.200" zIndex={1000}>
                <Text px={3} py={2} fontSize="10px" fontWeight="bold" color="whiteAlpha.400" textTransform="uppercase">Example Prompts</Text>
                <MenuItem bg="transparent" _hover={{ bg: 'whiteAlpha.100' }} fontSize="xs" onClick={() => executeAiAction("Generate a modern landing page for a coffee shop with a hero section, menu, and contact form.")}>Coffee Shop Landing Page</MenuItem>
                <MenuItem bg="transparent" _hover={{ bg: 'whiteAlpha.100' }} fontSize="xs" onClick={() => executeAiAction("Create a professional portfolio website for a photographer with a gallery grid.")}>Photographer Portfolio</MenuItem>
                <MenuItem bg="transparent" _hover={{ bg: 'whiteAlpha.100' }} fontSize="xs" onClick={() => executeAiAction("Build a SaaS dashboard with sidebar navigation and data charts.")}>SaaS Dashboard</MenuItem>
                <MenuItem bg="transparent" _hover={{ bg: 'whiteAlpha.100' }} fontSize="xs" onClick={() => executeAiAction("Design a clean and minimal blog template with a reading list.")}>Minimal Blog Template</MenuItem>
              </MenuList>
            </Portal>
          </Menu>
          
          <HStack spacing={1}>
            <Tooltip label="Minimize Sidebar">
              <IconButton
                aria-label="Minimize"
                icon={<PanelLeftClose size={16} />}
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarMinimized(true)}
                color="whiteAlpha.600"
                _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
              />
            </Tooltip>
          </HStack>
        </Flex>

        {/* Integrated Status Bar */}
        <VStack spacing={0} borderBottom="1px solid" borderColor="whiteAlpha.100">
          <HStack w="full" px={4} py={1.5} spacing={4} bg="whiteAlpha.50" borderBottom="1px solid" borderColor="whiteAlpha.100" fontSize="9px" color="whiteAlpha.400">
            <HStack spacing={2}>
              <Box w={1.2} h={1.2} borderRadius="full" bg={isSaving ? "blue.400" : (isDirty ? "orange.400" : "green.400")} />
              <Text color="whiteAlpha.600" fontWeight="medium">
                {isSaving ? "Saving..." : (isDirty ? "Unsaved" : "Saved")}
              </Text>
            </HStack>
            {lastAutoSaveTime && (
              <HStack spacing={1}>
                <SaveAll size={8} color="gray" />
                <Text>{new Date(lastAutoSaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </HStack>
            )}
            <Divider orientation="vertical" h={2} />
            <Text textTransform="uppercase">{generationMode}</Text>
            <Spacer />
            <Text opacity={0.6}>Powered by {activeProvider?.name || 'AI'}</Text>
          </HStack>
          
          <HStack w="full" px={4} py={2} spacing={2} bg="whiteAlpha.50" borderBottom="1px solid" borderColor="whiteAlpha.100">
            <HStack spacing={1} bg="whiteAlpha.100" p={1} borderRadius="md">
              <Tooltip label="Website Mode">
                <IconButton
                  aria-label="Website Mode"
                  icon={<Globe size={14} />}
                  size="xs"
                  variant={generationMode === 'website' ? 'solid' : 'ghost'}
                  colorScheme={generationMode === 'website' ? 'blue' : 'gray'}
                  onClick={() => setGenerationMode('website')}
                />
              </Tooltip>
              <Tooltip label="Component Mode">
                <IconButton
                  aria-label="Component Mode"
                  icon={<BoxIcon size={14} />}
                  size="xs"
                  variant={generationMode === 'component' ? 'solid' : 'ghost'}
                  colorScheme={generationMode === 'component' ? 'cyan' : 'gray'}
                  onClick={() => setGenerationMode('component')}
                />
              </Tooltip>
            </HStack>
            
            <Divider orientation="vertical" h={4} />
            
            <Tooltip label="Generate Image">
              <IconButton
                aria-label="Generate Image"
                icon={<Layout size={14} />}
                size="xs"
                variant="ghost"
                onClick={onImageOpen}
                color="whiteAlpha.600"
                _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
              />
            </Tooltip>
            
            <Tooltip label="Thinking Mode">
              <IconButton
                aria-label="Thinking"
                icon={<BrainCircuit size={14} />}
                size="xs"
                variant={isThinking ? 'solid' : 'ghost'}
                colorScheme="purple"
                onClick={() => setIsThinking(!isThinking)}
              />
            </Tooltip>

            <Spacer />

            <Tooltip label="Clear Chat & Save Snapshot">
              <IconButton 
                aria-label="Clear Chat" 
                icon={<Trash2 size={14} />} 
                size="xs" 
                variant="ghost" 
                color="whiteAlpha.600"
                _hover={{ bg: 'red.600', color: 'white' }}
                onClick={clearChatAndSave}
              />
            </Tooltip>
          </HStack>
          
          {generationMode === 'component' && (
            <HStack w="full" px={4} py={2} spacing={2} overflowX="auto" className="no-scrollbar" bg="whiteAlpha.50">
              <Text fontSize="9px" fontWeight="bold" color="whiteAlpha.400" textTransform="uppercase">Quick:</Text>
              <Button 
                size="xs" 
                variant="ghost" 
                fontSize="9px" 
                onClick={() => executeAiAction("Generate a modern, responsive card component with an image, title, and description.")}
                aria-label="Generate Card Component"
              >
                Card
              </Button>
              <Button 
                size="xs" 
                variant="ghost" 
                fontSize="9px" 
                onClick={() => executeAiAction("Generate a stylish contact form with validation.")}
                aria-label="Generate Form Component"
              >
                Form
              </Button>
              <Button 
                size="xs" 
                variant="ghost" 
                fontSize="9px" 
                onClick={() => executeAiAction("Generate a set of modern, accessible buttons with different variants.")}
                aria-label="Generate Buttons Component"
              >
                Buttons
              </Button>
              <Button 
                size="xs" 
                variant="ghost" 
                fontSize="9px" 
                onClick={() => executeAiAction("Generate a responsive navigation bar with a logo and links.")}
                aria-label="Generate Navbar Component"
              >
                Navbar
              </Button>
            </HStack>
          )}
        </VStack>

        {/* Chat History */}
        <Box flex={1} position="relative" display="flex" flexDirection="column" overflow="hidden">
          <Box px={4} py={2} borderBottom="1px solid" borderColor="whiteAlpha.100" display="flex" alignItems="center" gap={2}>
            <Menu size="sm">
              <MenuButton 
                as={Button} 
                size="xs" 
                variant="ghost" 
                rightIcon={<ChevronDown size={10} />}
                fontSize="10px"
                color="whiteAlpha.700"
                _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                p={1}
                h="auto"
                maxW="120px"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {settings.activeProviderId.toUpperCase()}: {typeof model === 'string' ? model.split(':').pop()?.replace('gemini-', '') : model}
              </MenuButton>
              <Portal>
                <MenuList bg="#1a1a24" borderColor="whiteAlpha.200" zIndex={2000} maxH="300px" overflowY="auto">
                  <Text px={3} py={1} fontSize="10px" fontWeight="bold" color="whiteAlpha.400" textTransform="uppercase">Favorite Models</Text>
                  {(settings.favoriteModels || []).map((m, i) => {
                    const provider = (settings.providers || []).find(p => p.availableModels.some(am => am.name === m));
                    const displayName = m.split(':').pop();
                    const fullName = provider ? `${provider.name} - ${displayName}` : displayName;
                    return (
                      <MenuItem 
                        key={`fav-${m}-${i}`} 
                        fontSize="xs" 
                        bg="transparent" 
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onClick={() => setModel(m)}
                      >
                        {fullName}
                      </MenuItem>
                    );
                  })}
                  <Divider my={1} borderColor="whiteAlpha.100" />
                  <Text px={3} py={1} fontSize="10px" fontWeight="bold" color="whiteAlpha.400" textTransform="uppercase">All Models</Text>
                  {settings.activeProviderId === 'google' && [ModelType.FLASH, ModelType.PRO, ModelType.LITE].filter(m => {
                    const name = (m === ModelType.FLASH ? 'Gemini 2.0 Flash' : m === ModelType.PRO ? 'Gemini 2.0 Pro' : 'Gemini 2.0 Lite').toLowerCase();
                    const matchesSearch = name.includes(modelSearchQuery.toLowerCase());
                    return matchesSearch;
                  }).map((m, i) => (
                    <MenuItem 
                      key={`google-${m}-${i}`} 
                      fontSize="xs" 
                      bg="transparent" 
                      _hover={{ bg: 'whiteAlpha.100' }}
                      onClick={() => setModel(`google:${m}`)}
                    >
                      Google - {m === ModelType.FLASH ? 'Gemini 2.0 Flash' : m === ModelType.PRO ? 'Gemini 2.0 Pro' : 'Gemini 2.0 Lite'}
                    </MenuItem>
                  ))}
                  {allFilteredModels?.map((m, i) => (
                    <MenuItem 
                      key={`all-${m.providerId}-${m.name}-${i}`} 
                      fontSize="xs" 
                      bg="transparent" 
                      _hover={{ bg: 'whiteAlpha.100' }}
                      onClick={() => setModel(m.name)}
                    >
                      {m.providerName} - {m.displayName || m.name.split(':').pop()}
                    </MenuItem>
                  ))}
                  <Divider my={1} borderColor="whiteAlpha.100" />
                  <MenuItem fontSize="xs" bg="transparent" _hover={{ bg: 'whiteAlpha.100' }} onClick={onSettingsOpen}>
                    Manage Models...
                  </MenuItem>
                </MenuList>
              </Portal>
            </Menu>

            <InputGroup size="xs" flex={1}>
              <InputLeftElement pointerEvents="none">
                <Search size={12} color="gray" />
              </InputLeftElement>
              <Input 
                placeholder="Search chat..." 
                bg="whiteAlpha.50" 
                border="none" 
                borderRadius="full"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
              />
            </InputGroup>
          </Box>
          
          <Box 
            ref={chatContainerRef}
            flex={1} 
            overflowY="auto" 
            p={4} 
            display="flex" 
            flexDirection="column" 
            gap={4}
          >
            {filteredMessages.length === 0 && !isLoading && (
              <VStack h="full" justify="center" opacity={0.4} spacing={4}>
                <Box p={4} borderRadius="full" bg="whiteAlpha.100">
                  <Terminal size={32} />
                </Box>
                <VStack spacing={1}>
                  <Text fontSize="sm" fontWeight="medium">
                    {chatSearchQuery ? "No messages found" : "Ready to build?"}
                  </Text>
                  <Text fontSize="xs" textAlign="center">
                    {chatSearchQuery 
                      ? "Try a different search term."
                      : (generationMode === 'website' 
                        ? "Describe a website or landing page to get started." 
                        : "Describe a UI component to generate it.")}
                  </Text>
                </VStack>
              </VStack>
            )}

            {filteredMessages?.map((msg, i) => (
              <Flex key={i} justify={msg.role === 'user' ? 'flex-end' : 'flex-start'} direction="column" align={msg.role === 'user' ? 'flex-end' : 'flex-start'} className="group">
                <HStack spacing={2} mb={1} px={1}>
                  <Text fontSize="10px" fontWeight="bold" color="whiteAlpha.600">
                    {msg.role === 'user' ? 'You' : (model.toString().split('/').pop() || 'AI')}
                  </Text>
                  <Text fontSize="10px" color="whiteAlpha.400">
                    | {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </HStack>
                <Box 
                  maxW="85%" 
                  p={3} 
                  borderRadius="2xl" 
                  borderTopRightRadius={msg.role === 'user' ? 'none' : '2xl'}
                  borderTopLeftRadius={msg.role === 'model' ? 'none' : '2xl'}
                  bg={msg.role === 'user' ? 'blue.600' : 'whiteAlpha.100'}
                  color={msg.role === 'user' ? 'white' : 'slate.200'}
                  border={msg.role === 'model' ? '1px solid' : 'none'}
                  borderColor="whiteAlpha.200"
                  fontSize="xs"
                  lineHeight="relaxed"
                  className="markdown-chat"
                  position="relative"
                  _hover={{ ".chat-actions": { opacity: 1 } }}
                >
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  
                  {/* Chat Actions */}
                  <HStack 
                    className="chat-actions"
                    position="absolute" 
                    bottom="-24px" 
                    right={msg.role === 'user' ? 0 : 'auto'}
                    left={msg.role === 'model' ? 0 : 'auto'}
                    spacing={1} 
                    opacity={0} 
                    transition="opacity 0.2s"
                    zIndex={5}
                    py={1}
                  >
                    {msg.role === 'user' && (
                      <Tooltip label="Resend">
                        <IconButton aria-label="Resend" icon={<RotateCcw size={10} />} size="xs" variant="ghost" color="whiteAlpha.400" _hover={{ color: 'white', bg: 'whiteAlpha.100' }} onClick={() => executeAiAction(msg.content)} />
                      </Tooltip>
                    )}
                    <Tooltip label="Copy">
                      <IconButton aria-label="Copy" icon={<Copy size={10} />} size="xs" variant="ghost" color="whiteAlpha.400" _hover={{ color: 'white', bg: 'whiteAlpha.100' }} onClick={() => navigator.clipboard.writeText(msg.content)} />
                    </Tooltip>
                    <Tooltip label="Edit">
                      <IconButton aria-label="Edit" icon={<Edit3 size={10} />} size="xs" variant="ghost" color="whiteAlpha.400" _hover={{ color: 'white', bg: 'whiteAlpha.100' }} onClick={() => setUserInput(msg.content)} />
                    </Tooltip>
                    <Tooltip label="Delete">
                      <IconButton aria-label="Delete" icon={<Trash2 size={10} />} size="xs" variant="ghost" color="whiteAlpha.400" _hover={{ color: 'red.400', bg: 'whiteAlpha.100' }} onClick={() => {
                        const newMsgs = [...messages];
                        newMsgs.splice(i, 1);
                        useStore.getState().setMessages(newMsgs);
                      }} />
                    </Tooltip>
                  </HStack>
                </Box>
                <Box h={6} /> {/* Spacer for actions */}
              </Flex>
            ))}

            {isLoading && (
              <Flex justify="flex-start">
                <VStack align="start" spacing={2} w="full">
                  <HStack spacing={2}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw size={14} color="#4299E1" />
                    </motion.div>
                    <Text fontSize="xs" color="blue.400" fontWeight="bold">AI is generating...</Text>
                  </HStack>
                  <Box w="full" p={3} borderRadius="2xl" bg="whiteAlpha.50" border="1px dashed" borderColor="whiteAlpha.200">
                    <SkeletonText noOfLines={3} spacing="2" skeletonHeight="2" />
                    <Progress size="xs" isIndeterminate colorScheme="blue" mt={4} borderRadius="full" />
                  </Box>
                </VStack>
              </Flex>
            )}
            <div ref={chatEndRef} />
          </Box>

          <AnimatePresence>
            {showScrollTop && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 10 }}
              >
                <IconButton
                  aria-label="Scroll to top"
                  icon={<ArrowUp size={16} />}
                  size="sm"
                  colorScheme="blue"
                  borderRadius="full"
                  onClick={scrollToTop}
                  boxShadow="lg"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Error Handling UI */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Alert status="error" variant="solid" bg="red.900" color="white" borderRadius="none" py={3}>
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle fontSize="xs">Generation Failed</AlertTitle>
                  <AlertDescription fontSize="10px" display="block">
                    {error}
                  </AlertDescription>
                </Box>
                <Button 
                  size="xs" 
                  colorScheme="whiteAlpha" 
                  leftIcon={<RefreshCw size={12} />}
                  onClick={retryLastAction}
                  ml={2}
                  aria-label="Retry last generation"
                >
                  Retry
                </Button>
                <CloseButton 
                  size="sm" 
                  position="absolute" 
                  right="2px" 
                  top="2px" 
                  onClick={() => setError(null)} 
                  aria-label="Close error message"
                />
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <Box p={isMobile ? 2 : 4} borderTop="1px solid" borderColor="whiteAlpha.100" bg="#0d0d11">
          <Box position="relative">
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (userInput.trim() && !isLoading) {
                    handleSend();
                  }
                }
              }}
              placeholder={html ? "Ask for changes..." : (generationMode === 'website' ? "Describe your site..." : "Describe your component...")}
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.200"
              borderRadius="xl"
              p={3}
              pr={12}
              fontSize="xs"
              _focus={{ borderColor: 'blue.500', ring: 1, ringColor: 'blue.500/50' }}
              resize="none"
              h={isMobile ? "60px" : "100px"}
              isDisabled={isLoading}
            />
            <IconButton
              aria-label="Send"
              icon={<Send size={18} />}
              position="absolute"
              right={2}
              bottom={2}
              colorScheme="blue"
              size="sm"
              onClick={() => {
                if (userInput.trim() && !isLoading) {
                  handleSend();
                }
              }}
              isDisabled={isLoading || !userInput.trim()}
            />
          </Box>
          <Flex justify="space-between" align="center" mt={2}>
            <Text fontSize="10px" color="whiteAlpha.400">
              Token usage: ~{Math.round(html.length / 4)} tokens
            </Text>
            {!isMobile && (
              <Text fontSize="10px" color="whiteAlpha.400" textAlign="center">
                Press Enter to send. Shift+Enter for new line.
              </Text>
            )}
          </Flex>
        </Box>
      </Box>

      {/* Cookie Consent Banner */}
      <AnimatePresence>
        {showCookieConsent && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '20px',
              right: '20px',
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <Box 
              bg="#1a1a24" 
              p={4} 
              borderRadius="xl" 
              boxShadow="0 10px 30px rgba(0,0,0,0.5)" 
              border="1px solid" 
              borderColor="whiteAlpha.200"
              maxW="600px"
              w="full"
            >
              <VStack align="stretch" spacing={3}>
                <HStack justify="space-between">
                  <HStack>
                    <Box p={2} bg="blue.500" borderRadius="lg">
                      <Sparkles size={16} color="white" />
                    </Box>
                    <Text fontWeight="bold" fontSize="sm">Cookie Consent</Text>
                  </HStack>
                  <CloseButton size="sm" onClick={() => setShowCookieConsent(false)} />
                </HStack>
                <Text fontSize="xs" color="whiteAlpha.700">
                  We use cookies to enhance your experience, analyze site traffic, and personalize content. By clicking "Accept", you consent to our use of cookies.
                </Text>
                <HStack justify="flex-end" spacing={3}>
                  <Button size="xs" variant="ghost" onClick={() => handleCookieConsent(false)}>Reject</Button>
                  <Button size="xs" colorScheme="blue" onClick={() => handleCookieConsent(true)}>Accept All</Button>
                </HStack>
              </VStack>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize Handle */}
      {!isSidebarMinimized && !isMobile && (
        <Box
          w="4px"
          cursor="col-resize"
          bg={isResizing ? "blue.500" : "transparent"}
          _hover={{ bg: "blue.500" }}
          onMouseDown={startResizing}
          zIndex={10}
          transition="background 0.2s"
        />
      )}

      {/* Expand Button (Floating) */}
      {isSidebarMinimized && (
        <Tooltip label="Expand Sidebar">
          <IconButton
            aria-label="Expand"
            icon={<PanelLeftOpen size={20} />}
            position="absolute"
            top={4}
            left={4}
            zIndex={20}
            colorScheme="blue"
            size="sm"
            onClick={() => setIsSidebarMinimized(false)}
            boxShadow="0 4px 12px rgba(0,0,0,0.5)"
          />
        </Tooltip>
      )}

      {/* Main Preview Panel */}
      <Flex flex={1} direction="column" bg="#050507" w="full" h={isMobile ? "55%" : "full"}>
        <Flex h={14} borderBottom="1px solid" borderColor="whiteAlpha.100" align="center" justify="space-between" px={4} bg="#0d0d11">
          <HStack spacing={4}>
            <HStack spacing={1} bg="whiteAlpha.50" p={1} borderRadius="lg">
              <Tooltip label="Preview Tab">
                <IconButton 
                  size="sm" 
                  variant={activeTab === 'preview' ? 'solid' : 'ghost'} 
                  colorScheme={activeTab === 'preview' ? 'blue' : 'gray'}
                  onClick={() => setActiveTab('preview')}
                  icon={<Eye size={16} />}
                  aria-label="Preview"
                />
              </Tooltip>
              <Tooltip label="Code Tab">
                <IconButton 
                  size="sm" 
                  variant={activeTab === 'code' ? 'solid' : 'ghost'} 
                  colorScheme={activeTab === 'code' ? 'blue' : 'gray'}
                  onClick={() => setActiveTab('code')}
                  icon={<Code size={16} />}
                  aria-label="Code"
                />
              </Tooltip>
              <Divider orientation="vertical" h={4} mx={1} />
              <Menu>
                <Tooltip label="Project Management">
                  <MenuButton
                    as={IconButton}
                    aria-label="Projects"
                    icon={<FolderOpen size={16} />}
                    variant="ghost"
                    size="sm"
                    color="whiteAlpha.600"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  />
                </Tooltip>
                <Portal>
                  <MenuList bg="#1a1a24" borderColor="whiteAlpha.200" zIndex={1000}>
                    <MenuItem icon={<Save size={14} />} onClick={() => saveProject(projectName || 'New Project')} bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Save Current</MenuItem>
                    <MenuItem icon={<Copy size={14} />} onClick={onSaveAsOpen} bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Save As...</MenuItem>
                    <MenuItem icon={<FolderOpen size={14} />} onClick={onLoadOpen} bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Load Project</MenuItem>
                    <Divider my={1} borderColor="whiteAlpha.100" />
                    <MenuItem icon={<Trash2 size={14} />} onClick={clearChat} color="red.400" bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Clear All</MenuItem>
                  </MenuList>
                </Portal>
              </Menu>
            </HStack>

            <HStack spacing={1}>
              <Tooltip label="Undo">
                <IconButton aria-label="Undo" icon={<Undo2 size={16} />} size="sm" variant="ghost" isDisabled={historyIndex <= 0} onClick={undo} color="whiteAlpha.600" _hover={{ bg: 'whiteAlpha.100', color: 'white' }} />
              </Tooltip>
              <Tooltip label="Redo">
                <IconButton aria-label="Redo" icon={<Redo2 size={16} />} size="sm" variant="ghost" isDisabled={historyIndex >= undoHistory.length - 1} onClick={redo} color="whiteAlpha.600" _hover={{ bg: 'whiteAlpha.100', color: 'white' }} />
              </Tooltip>
              <Tooltip label="Reload Preview">
                <IconButton aria-label="Reload" icon={<RefreshCw size={16} />} size="sm" variant="ghost" onClick={() => setHtml(html)} color="whiteAlpha.600" _hover={{ bg: 'whiteAlpha.100', color: 'white' }} />
              </Tooltip>
            </HStack>

            {activeTab === 'preview' && (
              <HStack spacing={1} bg="whiteAlpha.50" p={1} borderRadius="lg">
                <Menu size="xs">
                  <Tooltip label="Responsive View">
                    <MenuButton
                      as={IconButton}
                      aria-label="View Mode"
                      icon={
                        previewMode === 'desktop' ? <Monitor size={14} /> : 
                        previewMode === 'tablet' ? <Tablet size={14} /> : 
                        <Smartphone size={14} />
                      }
                      size="xs"
                      variant="ghost"
                      colorScheme="blue"
                    />
                  </Tooltip>
                  <Portal>
                    <MenuList bg="#1a1a24" borderColor="whiteAlpha.200" zIndex={1000}>
                      <MenuItem icon={<Monitor size={14} />} onClick={() => setPreviewMode('desktop')} bg={previewMode === 'desktop' ? 'whiteAlpha.200' : 'transparent'} _hover={{ bg: 'whiteAlpha.100' }}>Desktop View</MenuItem>
                      <MenuItem icon={<Tablet size={14} />} onClick={() => setPreviewMode('tablet')} bg={previewMode === 'tablet' ? 'whiteAlpha.200' : 'transparent'} _hover={{ bg: 'whiteAlpha.100' }}>Tablet View</MenuItem>
                      <MenuItem icon={<Smartphone size={14} />} onClick={() => setPreviewMode('mobile')} bg={previewMode === 'mobile' ? 'whiteAlpha.200' : 'transparent'} _hover={{ bg: 'whiteAlpha.100' }}>Mobile View</MenuItem>
                    </MenuList>
                  </Portal>
                </Menu>
              </HStack>
            )}
          </HStack>

          <HStack spacing={4}>
            <HStack spacing={2}>
              {activeTab === 'code' && (
                <HStack spacing={2}>
                  <Tooltip label="Optimize Code (Lazy Loading, Smooth Scroll, etc.)">
                    <Button
                      size="sm"
                      leftIcon={<Zap size={14} />}
                      onClick={() => {
                        optimizeCode();
                        toast({ title: "Code Optimized", description: "Added lazy loading, smooth scroll, and more.", status: "success", duration: 3000 });
                      }}
                      isDisabled={!html || isLoading}
                      variant="outline"
                      borderColor="whiteAlpha.200"
                      fontSize="xs"
                      colorScheme="yellow"
                      aria-label="Optimize generated code"
                    >
                      Optimize
                    </Button>
                  </Tooltip>
                  <Tooltip label="Refactor Code">
                    <Button
                      size="sm"
                      leftIcon={<RefreshCw size={14} />}
                      onClick={handleRefactor}
                      isDisabled={!html || isLoading}
                      variant="outline"
                      borderColor="whiteAlpha.200"
                      fontSize="xs"
                      colorScheme="cyan"
                      aria-label="Refactor generated code"
                    >
                      Refactor
                    </Button>
                  </Tooltip>
                </HStack>
              )}
              
              <Tooltip label="Export Options">
                <Menu>
                  <MenuButton
                    as={IconButton}
                    aria-label="Export"
                    icon={<Download size={16} />}
                    variant="outline"
                    size="sm"
                    borderColor="whiteAlpha.200"
                    color="whiteAlpha.600"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                    isDisabled={!html}
                  />
                  <Portal>
                    <MenuList bg="#1a1a24" borderColor="whiteAlpha.200" zIndex={1000}>
                      <MenuItem icon={<Globe size={14} />} onClick={copyToClipboard} bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Copy HTML</MenuItem>
                      <MenuItem icon={<FileCode2 size={14} />} onClick={handleExportHtml} bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Export HTML</MenuItem>
                      <MenuItem icon={<FileJson size={14} />} onClick={handleExportZip} bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Export ZIP</MenuItem>
                    </MenuList>
                  </Portal>
                </Menu>
              </Tooltip>

              <Divider orientation="vertical" h={6} borderColor="whiteAlpha.200" mx={1} />

              <HStack spacing={1}>
                {!user ? (
                  <Button 
                    size="xs" 
                    colorScheme="blue" 
                    onClick={handleLogin}
                    aria-label="Login with Google"
                  >
                    Login
                  </Button>
                ) : (
                  <Menu>
                    <MenuButton>
                      <Tooltip label={user.displayName || 'User'}>
                        <Box w={6} h={6} borderRadius="full" overflow="hidden" border="1px solid" borderColor="whiteAlpha.300">
                          <img src={user.photoURL || ''} alt="User" referrerPolicy="no-referrer" />
                        </Box>
                      </Tooltip>
                    </MenuButton>
                    <Portal>
                      <MenuList bg="#1a1a24" borderColor="whiteAlpha.200" zIndex={1000}>
                        <MenuItem icon={<LogOut size={14} />} onClick={() => auth.signOut()} bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>Logout</MenuItem>
                      </MenuList>
                    </Portal>
                  </Menu>
                )}
                <Tooltip label="Versions">
                  <IconButton
                    aria-label="Versions"
                    icon={<History size={16} />}
                    variant="ghost"
                    size="sm"
                    onClick={onVersionsOpen}
                    color="whiteAlpha.600"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  />
                </Tooltip>
                <Tooltip label="Settings">
                  <IconButton
                    aria-label="Settings"
                    icon={<Settings size={16} />}
                    variant="ghost"
                    size="sm"
                    onClick={onSettingsOpen}
                    color="whiteAlpha.600"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  />
                </Tooltip>
              </HStack>
            </HStack>
          </HStack>
        </Flex>

        {isLoading && <Progress size="xs" isIndeterminate colorScheme="blue" bg="transparent" />}

        <Box flex={1} position="relative" p={4} display="flex" alignItems="center" justifyContent="center">
          <AnimatePresence mode="wait">
            {activeTab === 'preview' ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}
              >
                {!html && !isLoading ? (
                  <VStack spacing={4} opacity={0.2} justify="center">
                    <Layout size={80} />
                    <Text fontSize="xl" fontWeight="bold">No {generationMode} generated yet</Text>
                  </VStack>
                ) : isLoading && !html ? (
                  <VStack w="full" h="full" spacing={6} justify="center">
                    <Skeleton w={getIframeWidth()} h="full" borderRadius="xl" />
                    <VStack spacing={2} w="300px">
                      <Text fontSize="xs" color="whiteAlpha.500">Generating initial {generationMode}...</Text>
                      <Progress w="full" size="xs" isIndeterminate borderRadius="full" colorScheme="blue" />
                    </VStack>
                  </VStack>
                ) : (
                  <Box 
                    bg="white" 
                    borderRadius="xl" 
                    boxShadow="2xl" 
                    overflow="hidden" 
                    transition="all 0.5s"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    w={getIframeWidth()}
                    h="full"
                    position="relative"
                  >
                    {isLoading && (
                      <Box position="absolute" inset={0} bg="whiteAlpha.700" backdropFilter="blur(2px)" zIndex={10} display="flex" alignItems="center" justifyContent="center">
                        <VStack spacing={3}>
                          <RefreshCw size={24} className="animate-spin text-blue-600" />
                          <Text color="blue.600" fontSize="xs" fontWeight="bold">Updating Preview...</Text>
                        </VStack>
                      </Box>
                    )}
                    <iframe
                      ref={iframeRef}
                      srcDoc={html}
                      title="Preview"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  </Box>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ width: '100%', height: '100%' }}
              >
                <Box h="full" w="full" position="relative" borderRadius="xl" overflow="hidden" border="1px solid" borderColor="whiteAlpha.100">
                  <Editor
                    height="100%"
                    defaultLanguage="html"
                    theme={settings.theme}
                    value={html}
                    onMount={handleEditorDidMount}
                    onChange={(value) => {
                      if (settings.autoPreview) {
                        setHtml(value || '');
                      }
                    }}
                    options={{
                      fontSize: settings.fontSize,
                      wordWrap: settings.wordWrap,
                      minimap: { enabled: settings.minimap },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                  
                  {/* Editor Toolbar Overlay */}
                  <HStack position="absolute" top={2} right={4} spacing={2} zIndex={5}>
                    <Tooltip label="Undo (Ctrl+Z)">
                      <IconButton 
                        aria-label="Undo" 
                        icon={<Undo2 size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="whiteAlpha.100" 
                        _hover={{ bg: 'whiteAlpha.200' }}
                        onClick={() => editorRef.current?.trigger('keyboard', 'undo', null)}
                      />
                    </Tooltip>
                    <Tooltip label="Redo (Ctrl+Y)">
                      <IconButton 
                        aria-label="Redo" 
                        icon={<Redo2 size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="whiteAlpha.100" 
                        _hover={{ bg: 'whiteAlpha.200' }}
                        onClick={() => editorRef.current?.trigger('keyboard', 'redo', null)}
                      />
                    </Tooltip>
                    <Tooltip label="Copy All Code">
                      <IconButton 
                        aria-label="Copy Code" 
                        icon={copied ? <Check size={14} /> : <Copy size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg={copied ? "green.500" : "whiteAlpha.100"}
                        _hover={{ bg: copied ? "green.600" : "whiteAlpha.200" }}
                        onClick={copyToClipboard}
                      />
                    </Tooltip>
                    <Tooltip label="Format Code (Shift+Alt+F)">
                      <IconButton 
                        aria-label="Format" 
                        icon={<Terminal size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="whiteAlpha.100" 
                        _hover={{ bg: 'whiteAlpha.200' }}
                        onClick={() => editorRef.current?.getAction('editor.action.formatDocument')?.run()}
                      />
                    </Tooltip>
                    <Divider orientation="vertical" h={3} />
                    <Tooltip label="Add Comments (AI)">
                      <IconButton 
                        aria-label="Add Comments" 
                        icon={<Sparkles size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="purple.600" 
                        _hover={{ bg: 'purple.700' }}
                        onClick={() => executeAiAction("Analyze this HTML and add detailed comments explaining complex sections or non-obvious logic.")}
                      />
                    </Tooltip>
                    <Tooltip label="Semantic Refactor (AI)">
                      <IconButton 
                        aria-label="Semantic Refactor" 
                        icon={<Layout size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="cyan.600" 
                        _hover={{ bg: 'cyan.700' }}
                        onClick={() => executeAiAction("Refactor this HTML to use semantic HTML5 tags (header, nav, section, footer, etc.) where appropriate.")}
                      />
                    </Tooltip>
                    <Divider orientation="vertical" h={3} />
                    <Tooltip label="Format Code (Ctrl+Shift+F)">
                      <IconButton 
                        aria-label="Format" 
                        icon={<FileCode size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="whiteAlpha.100" 
                        _hover={{ bg: 'whiteAlpha.200' }}
                        onClick={() => editorRef.current?.getAction('editor.action.formatDocument')?.run()}
                      />
                    </Tooltip>
                    <Tooltip label="Copy All Code">
                      <IconButton 
                        aria-label="Copy All" 
                        icon={<CopyIcon size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="whiteAlpha.100" 
                        _hover={{ bg: 'whiteAlpha.200' }}
                        onClick={copyToClipboard}
                      />
                    </Tooltip>
                    <Tooltip label="Save Project (Ctrl+S)">
                      <IconButton 
                        aria-label="Save" 
                        icon={<Save size={14} />} 
                        size="xs" 
                        variant="solid" 
                        bg="blue.600" 
                        _hover={{ bg: 'blue.700' }}
                        onClick={() => saveProject(projectName || 'Untitled Project')}
                      />
                    </Tooltip>
                  </HStack>

                  {isLoading && (
                    <Box position="absolute" top={4} right={20} zIndex={10}>
                      <HStack bg="blue.600" px={3} py={1} borderRadius="full" boxShadow="0 0 20px rgba(66, 153, 225, 0.4)">
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <Box w={2} h={2} borderRadius="full" bg="white" />
                        </motion.div>
                        <Text fontSize="10px" fontWeight="bold" color="white" letterSpacing="wider">STREAMING</Text>
                      </HStack>
                    </Box>
                  )}
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Flex>

      {/* Imagen Modal */}
      <Modal isOpen={isImageOpen} onClose={onImageClose}>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">Generate Image with Imagen</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text fontSize="xs" color="whiteAlpha.600">Describe the image you want to generate. It will be added to your project.</Text>
              <Textarea 
                placeholder="A futuristic city with neon lights..." 
                value={imagePrompt} 
                onChange={(e) => setImagePrompt(e.target.value)}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                fontSize="sm"
                rows={3}
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="ghost" mr={3} onClick={onImageClose}>Cancel</Button>
            <Button 
              size="sm" 
              colorScheme="blue" 
              onClick={handleGenerateImage} 
              isLoading={isGeneratingImageStore}
              isDisabled={!imagePrompt.trim()}
              loadingText="Generating..."
            >
              Generate & Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Save Project Modal */}
      <Modal isOpen={isSaveOpen} onClose={onSaveClose}>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">Save Project</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text fontSize="xs" color="whiteAlpha.600">Enter a name for your project to save it to local storage.</Text>
              <Input 
                placeholder="Project Name" 
                value={projectName} 
                onChange={(e) => setProjectName(e.target.value)}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                fontSize="sm"
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="ghost" mr={3} onClick={onSaveClose}>Cancel</Button>
            <Button size="sm" colorScheme="blue" onClick={handleSave} isDisabled={!projectName.trim()}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Save Project As Modal */}
      <Modal isOpen={isSaveAsOpen} onClose={onSaveAsClose}>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">Save Project As</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text fontSize="xs" color="whiteAlpha.600">Enter a new name for this project copy.</Text>
              <Input 
                placeholder="New Project Name" 
                value={saveAsName} 
                onChange={(e) => setSaveAsName(e.target.value)}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                fontSize="sm"
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="ghost" mr={3} onClick={onSaveAsClose}>Cancel</Button>
            <Button size="sm" colorScheme="blue" onClick={handleSaveAs} isDisabled={!saveAsName.trim()}>Save Copy</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Load Project Modal */}
      <Modal isOpen={isLoadOpen} onClose={onLoadClose} size="xl">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">Load Project</ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH="400px" overflowY="auto">
            <VStack spacing={4} align="stretch" mb={4}>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none">
                  <Search size={14} color="gray" />
                </InputLeftElement>
                <Input 
                  placeholder="Search projects..." 
                  bg="whiteAlpha.50" 
                  borderColor="whiteAlpha.200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </VStack>
            {filteredProjects.length === 0 ? (
              <Text fontSize="xs" color="whiteAlpha.400" textAlign="center" py={8}>No projects found.</Text>
            ) : (
              <VStack spacing={2} align="stretch">
                {filteredProjects?.map(project => (
                  <HStack key={project.id} p={3} bg="whiteAlpha.50" borderRadius="lg" justify="space-between" _hover={{ bg: 'whiteAlpha.100' }}>
                    <VStack align="start" spacing={0}>
                      <HStack>
                        <Text fontSize="sm" fontWeight="bold">{project.name}</Text>
                        {project.isAutoSave && <Badge colorScheme="orange" fontSize="8px">Auto-save</Badge>}
                      </HStack>
                      <Text fontSize="10px" color="whiteAlpha.500">{new Date(project.timestamp).toLocaleString()} • {project.mode}</Text>
                    </VStack>
                    <HStack>
                      <IconButton aria-label="Copy" icon={<CopyIcon size={14} />} size="xs" colorScheme="teal" variant="ghost" onClick={() => { copyProject(project.id); toast({ title: "Project copied", status: "success", duration: 2000 }); }} />
                      <Button size="xs" colorScheme="blue" onClick={() => { 
                        loadProject(project.id); 
                        setProjectName(project.name); 
                        onLoadClose(); 
                        toast({ title: `Loaded: ${project.name}`, status: "info", duration: 2000 });
                      }}>Load</Button>
                      <IconButton aria-label="Delete" icon={<Trash2 size={14} />} size="xs" colorScheme="red" variant="ghost" onClick={() => { deleteProject(project.id); toast({ title: "Project deleted", status: "error", duration: 2000 }); }} />
                    </HStack>
                  </HStack>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="ghost" onClick={onLoadClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={onSettingsClose} size="xl">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">Application Settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Accordion allowMultiple defaultIndex={[0, 1, 2]}>
              {/* AI Providers Section */}
              <AccordionItem border="none" mb={4}>
                <AccordionButton px={0} _hover={{ bg: 'transparent' }}>
                  <HStack flex="1" textAlign="left">
                    <Cloud size={16} />
                    <Text fontSize="sm" fontWeight="bold">AI Providers</Text>
                  </HStack>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={0} pt={2}>
                  <VStack align="stretch" spacing={4}>
                    <HStack>
                      <InputGroup size="xs">
                        <InputLeftElement pointerEvents="none">
                          <Search size={12} color="gray" />
                        </InputLeftElement>
                        <Input 
                          placeholder="Search providers..." 
                          value={providerSearchQuery}
                          onChange={(e) => setProviderSearchQuery(e.target.value)}
                          bg="whiteAlpha.50"
                          borderColor="whiteAlpha.100"
                        />
                      </InputGroup>
                      <Menu size="xs">
                        <MenuButton 
                          as={Button} 
                          leftIcon={<Plus size={12} />} 
                          size="xs" 
                          colorScheme="blue"
                        >
                          Provider
                        </MenuButton>
                        <Portal>
                          <MenuList bg="#1a1a24" borderColor="whiteAlpha.200" zIndex={2000}>
                            <Text px={3} py={1} fontSize="10px" fontWeight="bold" color="whiteAlpha.400" textTransform="uppercase">Preset Providers</Text>
                            {PRESET_PROVIDERS.map(p => (
                              <MenuItem 
                                key={p.name} 
                                fontSize="xs" 
                                bg="transparent" 
                                _hover={{ bg: 'whiteAlpha.100' }}
                                onClick={() => {
                                  setNewProvider({ ...newProvider, name: p.name, baseUrl: p.baseUrl });
                                  setShowAddProvider(true);
                                }}
                              >
                                {p.name}
                              </MenuItem>
                            ))}
                            <Divider my={1} borderColor="whiteAlpha.100" />
                            <MenuItem 
                              fontSize="xs" 
                              bg="transparent" 
                              _hover={{ bg: 'whiteAlpha.100' }}
                              onClick={() => {
                                setNewProvider({ name: '', apiKey: '', baseUrl: '', manualModels: [] });
                                setShowAddProvider(true);
                              }}
                              icon={<Plus size={12} />}
                            >
                              Custom Provider
                            </MenuItem>
                          </MenuList>
                        </Portal>
                      </Menu>
                    </HStack>

                    <AnimatePresence>
                      {showAddProvider && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <Box p={3} bg="whiteAlpha.50" borderRadius="lg" border="1px solid" borderColor="blue.500" mb={4}>
                            <VStack spacing={3} align="stretch">
                              <HStack justify="space-between">
                                <Text fontSize="xs" fontWeight="bold">Add New Provider</Text>
                                <HStack spacing={2}>
                                  {PRESET_PROVIDERS.find(p => p.name === newProvider.name)?.apiKeyUrl && (
                                    <Button 
                                      size="xs" 
                                      variant="outline" 
                                      fontSize="9px" 
                                      onClick={() => window.open(PRESET_PROVIDERS.find(p => p.name === newProvider.name)?.apiKeyUrl, '_blank')}
                                      leftIcon={<ExternalLink size={10} />}
                                    >
                                      Get API Key
                                    </Button>
                                  )}
                                  {PRESET_PROVIDERS.find(p => p.name === newProvider.name)?.docsUrl && (
                                    <Button 
                                      size="xs" 
                                      variant="ghost" 
                                      fontSize="9px" 
                                      onClick={() => window.open(PRESET_PROVIDERS.find(p => p.name === newProvider.name)?.docsUrl, '_blank')}
                                      leftIcon={<BookOpen size={10} />}
                                    >
                                      Docs
                                    </Button>
                                  )}
                                </HStack>
                              </HStack>
                              <Input 
                                placeholder="Provider Name (e.g. OpenRouter)" 
                                size="xs" 
                                value={newProvider.name}
                                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                              />
                              <Input 
                                placeholder="API Key" 
                                size="xs" 
                                type="password"
                                value={newProvider.apiKey}
                                onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                              />
                              <Input 
                                placeholder="Base URL (e.g. https://openrouter.ai/api/v1)" 
                                size="xs" 
                                value={newProvider.baseUrl}
                                onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                              />
                              
                              <Divider borderColor="whiteAlpha.100" />
                              <Text fontSize="10px" fontWeight="bold" color="whiteAlpha.400">MANUAL MODELS (OPTIONAL)</Text>
                              <HStack>
                                <Input 
                                  placeholder="Model ID" 
                                  size="xs" 
                                  value={manualModelId}
                                  onChange={(e) => setManualModelId(e.target.value)}
                                />
                                <Input 
                                  placeholder="Display Name" 
                                  size="xs" 
                                  value={manualModelName}
                                  onChange={(e) => setManualModelName(e.target.value)}
                                />
                                <IconButton 
                                  aria-label="Add Model" 
                                  icon={<Plus size={12} />} 
                                  size="xs" 
                                  onClick={() => {
                                    if (manualModelId && manualModelName) {
                                      setNewProvider({
                                        ...newProvider,
                                        manualModels: [...(newProvider.manualModels || []), { name: manualModelId, displayName: manualModelName }]
                                      });
                                      setManualModelId('');
                                      setManualModelName('');
                                    }
                                  }}
                                />
                              </HStack>
                              {newProvider.manualModels?.length > 0 && (
                                <HStack spacing={1} flexWrap="wrap">
                                  {newProvider.manualModels.map((m, i) => (
                                    <Badge key={i} colorScheme="blue" fontSize="8px" display="flex" alignItems="center">
                                      {m.displayName}
                                      <Box as="span" ml={1} cursor="pointer" onClick={() => {
                                        const updated = [...newProvider.manualModels];
                                        updated.splice(i, 1);
                                        setNewProvider({ ...newProvider, manualModels: updated });
                                      }}>×</Box>
                                    </Badge>
                                  ))}
                                </HStack>
                              )}

                              <Button 
                                size="xs" 
                                colorScheme="blue" 
                                onClick={() => {
                                  if (newProvider.name && newProvider.apiKey && newProvider.baseUrl) {
                                    addProvider(newProvider);
                                    setNewProvider({ name: '', apiKey: '', baseUrl: '', manualModels: [] });
                                    setShowAddProvider(false);
                                    toast({ title: "Provider added", status: "success", duration: 2000 });
                                  }
                                }}
                              >
                                Add Provider
                              </Button>
                            </VStack>
                          </Box>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <VStack align="stretch" spacing={2} className="no-scrollbar">
                      {filteredProviders?.map(provider => (
                        <HStack key={provider.id} p={2} bg="whiteAlpha.50" borderRadius="md" justify="space-between" _hover={{ bg: 'whiteAlpha.100' }}>
                          <HStack spacing={3} flex={1} cursor="pointer" onClick={() => startEditingProvider(provider)}>
                            <VStack align="start" spacing={0}>
                              <Text fontSize="xs" fontWeight="bold">{provider.name}</Text>
                              <Text fontSize="10px" color="whiteAlpha.400">{provider.id === 'google' ? 'Default' : (provider.baseUrl || 'OpenAI Compatible')}</Text>
                            </VStack>
                            <Edit3 size={12} color="gray" />
                          </HStack>
                          <HStack>
                            <Tooltip label="Test Connection">
                              <IconButton 
                                aria-label="Test Connection" 
                                icon={<RefreshCw size={12} />} 
                                size="xs" 
                                variant="ghost" 
                                colorScheme="teal"
                                onClick={() => handleTestConnection(provider.id)}
                                isLoading={isFetchingModels && settings.activeProviderId === provider.id}
                              />
                            </Tooltip>
                            <Button 
                              size="xs" 
                              variant={settings.activeProviderId === provider.id ? 'solid' : 'ghost'}
                              colorScheme={settings.activeProviderId === provider.id ? 'blue' : 'gray'}
                              onClick={() => updateSettings({ activeProviderId: provider.id })}
                            >
                              {settings.activeProviderId === provider.id ? 'Active' : 'Select'}
                            </Button>
                            {provider.id !== 'google' && (
                              <IconButton 
                                aria-label="Remove" 
                                icon={<Trash2 size={12} />} 
                                size="xs" 
                                variant="ghost" 
                                colorScheme="red"
                                onClick={() => removeProvider(provider.id)}
                              />
                            )}
                          </HStack>
                        </HStack>
                      ))}
                    </VStack>
                  </VStack>
                </AccordionPanel>
              </AccordionItem>

              {/* AI Model Section */}
              <AccordionItem border="none" mb={4}>
                <AccordionButton px={0} _hover={{ bg: 'transparent' }}>
                  <HStack flex="1" textAlign="left">
                    <BrainCircuit size={16} />
                    <Text fontSize="sm" fontWeight="bold">AI Model Configuration</Text>
                  </HStack>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={0} pt={2}>
                  <VStack align="stretch" spacing={4}>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel mb="0" fontSize="xs" color="whiteAlpha.600">Show free only</FormLabel>
                      <Switch size="sm" isChecked={settings.showFreeOnly} onChange={(e) => updateSettings({ showFreeOnly: e.target.checked })} />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="xs" color="whiteAlpha.600">Active Model</FormLabel>
                      <HStack>
                        <Select 
                          size="sm" 
                          bg="whiteAlpha.50" 
                          borderColor="whiteAlpha.200"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                        >
                          {settings.activeProviderId === 'google' && (
                            <>
                              <option value={ModelType.FLASH} style={{ background: '#1a1a24' }}>Gemini 2.0 Flash (Fast)</option>
                              <option value={ModelType.PRO} style={{ background: '#1a1a24' }}>Gemini 2.0 Pro (Thinking)</option>
                              <option value={ModelType.LITE} style={{ background: '#1a1a24' }}>Gemini 2.0 Lite</option>
                            </>
                          )}
                          {filteredModels?.map((m, i) => (
                            <option key={`${m.name}-${i}`} value={m.name} style={{ background: '#1a1a24' }}>{m.displayName || m.name}</option>
                          ))}
                        </Select>
                        <Tooltip label="Fetch/Refresh Models">
                          <IconButton 
                            aria-label="Fetch Models" 
                            icon={<RefreshCw size={14} />} 
                            size="sm" 
                            onClick={() => handleTestKey()} 
                            isLoading={isFetchingModels} 
                          />
                        </Tooltip>
                      </HStack>
                    </FormControl>

                    <Box p={3} bg="whiteAlpha.50" borderRadius="lg">
                      <Text fontSize="xs" fontWeight="bold" mb={2} color="whiteAlpha.700">Favorite Models</Text>
                      <InputGroup size="xs" mb={2}>
                        <InputLeftElement pointerEvents="none">
                          <Search size={10} color="gray" />
                        </InputLeftElement>
                        <Input 
                          placeholder="Search models..." 
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          bg="whiteAlpha.50"
                          borderColor="whiteAlpha.100"
                        />
                      </InputGroup>
                      <VStack align="stretch" spacing={2} maxH="150px" overflowY="auto" className="no-scrollbar">
                        {settings.activeProviderId === 'google' && [ModelType.FLASH, ModelType.PRO, ModelType.LITE].filter(m => (m === ModelType.FLASH ? 'Gemini 2.0 Flash' : m === ModelType.PRO ? 'Gemini 2.0 Pro' : 'Gemini 2.0 Lite').toLowerCase().includes(modelSearchQuery.toLowerCase())).map((m, i) => (
                          <HStack key={`settings-google-${m}-${i}`} justify="space-between" p={1}>
                            <Text fontSize="xs">{m === ModelType.FLASH ? 'Gemini 2.0 Flash' : m === ModelType.PRO ? 'Gemini 2.0 Pro' : 'Gemini 2.0 Lite'}</Text>
                            <IconButton 
                              aria-label="Favorite" 
                              icon={<Star size={12} fill={(settings.favoriteModels || []).includes(m) ? "gold" : "transparent"} color={(settings.favoriteModels || []).includes(m) ? "gold" : "gray"} />} 
                              size="xs" 
                              variant="ghost" 
                              onClick={() => toggleFavoriteModel(m)}
                            />
                          </HStack>
                        ))}
                        {filteredModels?.map((m, i) => (
                          <HStack key={`settings-all-${m.name}-${i}`} justify="space-between" p={1}>
                            <Text fontSize="xs">{m.displayName || m.name}</Text>
                            <IconButton 
                              aria-label="Favorite" 
                              icon={<Star size={12} fill={(settings.favoriteModels || []).includes(m.name) ? "gold" : "transparent"} color={(settings.favoriteModels || []).includes(m.name) ? "gold" : "gray"} />} 
                              size="xs" 
                              variant="ghost" 
                              onClick={() => toggleFavoriteModel(m.name)}
                            />
                          </HStack>
                        ))}
                      </VStack>
                    </Box>

                    <Box p={3} bg="whiteAlpha.50" borderRadius="lg">
                      <Text fontSize="xs" fontWeight="bold" mb={2} color="whiteAlpha.700">Add Model Manually</Text>
                      <VStack spacing={2}>
                        <Input 
                          size="xs" 
                          placeholder="Model ID (e.g. gpt-4o)" 
                          value={manualModelId}
                          onChange={(e) => setManualModelId(e.target.value)}
                        />
                        <Input 
                          size="xs" 
                          placeholder="Display Name (e.g. GPT-4o)" 
                          value={manualModelName}
                          onChange={(e) => setManualModelName(e.target.value)}
                        />
                        <Button 
                          size="xs" 
                          w="full" 
                          colorScheme="teal" 
                          onClick={() => handleAddManualModel(settings.activeProviderId)}
                          isDisabled={!manualModelId || !manualModelName}
                        >
                          Add Model to Current Provider
                        </Button>
                      </VStack>
                    </Box>

                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel mb="0" fontSize="xs" color="whiteAlpha.600">Enable Thinking (Gemini Pro only)</FormLabel>
                      <Switch size="sm" isChecked={isThinking} onChange={(e) => setIsThinking(e.target.checked)} isDisabled={model !== ModelType.PRO} />
                    </FormControl>
                  </VStack>
                </AccordionPanel>
              </AccordionItem>

              {/* Editor Preferences Section */}
              <AccordionItem border="none">
                <AccordionButton px={0} _hover={{ bg: 'transparent' }}>
                  <HStack flex="1" textAlign="left">
                    <Settings size={16} />
                    <Text fontSize="sm" fontWeight="bold">Editor Preferences</Text>
                  </HStack>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={0} pt={2}>
                  <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                    <FormControl>
                      <FormLabel fontSize="xs" color="whiteAlpha.600">Font Size</FormLabel>
                      <NumberInput 
                        size="sm" 
                        value={settings.fontSize} 
                        min={8} max={24}
                        onChange={(_, val) => updateSettings({ fontSize: val })}
                      >
                        <NumberInputField bg="whiteAlpha.50" borderColor="whiteAlpha.200" />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="xs" color="whiteAlpha.600">Theme</FormLabel>
                      <Select 
                        size="sm" 
                        bg="whiteAlpha.50" 
                        borderColor="whiteAlpha.200"
                        value={settings.theme}
                        onChange={(e) => updateSettings({ theme: e.target.value as any })}
                      >
                        <option value="vs-dark" style={{ background: '#1a1a24' }}>Dark</option>
                        <option value="gemini-dark" style={{ background: '#1a1a24' }}>Gemini Pro</option>
                        <option value="light" style={{ background: '#1a1a24' }}>Light</option>
                        <option value="hc-black" style={{ background: '#1a1a24' }}>High Contrast</option>
                      </Select>
                    </FormControl>

                    <FormControl display="flex" alignItems="center" justifyContent="space-between" gridColumn="span 2">
                      <FormLabel mb="0" fontSize="xs" color="whiteAlpha.600">Auto Preview</FormLabel>
                      <Switch size="sm" isChecked={settings.autoPreview} onChange={(e) => updateSettings({ autoPreview: e.target.checked })} />
                    </FormControl>

                    <FormControl display="flex" alignItems="center" justifyContent="space-between" gridColumn="span 2">
                      <FormLabel mb="0" fontSize="xs" color="whiteAlpha.600">Word Wrap</FormLabel>
                      <Switch size="sm" isChecked={settings.wordWrap === 'on'} onChange={(e) => updateSettings({ wordWrap: e.target.checked ? 'on' : 'off' })} />
                    </FormControl>

                    <FormControl display="flex" alignItems="center" justifyContent="space-between" gridColumn="span 2">
                      <FormLabel mb="0" fontSize="xs" color="whiteAlpha.600">Show Minimap</FormLabel>
                      <Switch size="sm" isChecked={settings.minimap} onChange={(e) => updateSettings({ minimap: e.target.checked })} />
                    </FormControl>
                  </Grid>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="ghost" onClick={onSettingsClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Provider Details Modal */}
      <Modal isOpen={isProviderDetailOpen} onClose={onProviderDetailClose} size="md">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">
            <HStack justify="space-between" pr={8}>
              <Text>{selectedProvider?.name} Details</Text>
              <HStack spacing={2}>
                {PRESET_PROVIDERS.find(p => p.name === selectedProvider?.name)?.apiKeyUrl && (
                  <Button 
                    size="xs" 
                    variant="outline" 
                    fontSize="9px" 
                    onClick={() => window.open(PRESET_PROVIDERS.find(p => p.name === selectedProvider?.name)?.apiKeyUrl, '_blank')}
                    leftIcon={<ExternalLink size={10} />}
                  >
                    Get API Key
                  </Button>
                )}
                {PRESET_PROVIDERS.find(p => p.name === selectedProvider?.name)?.docsUrl && (
                  <Button 
                    size="xs" 
                    variant="ghost" 
                    fontSize="9px" 
                    onClick={() => window.open(PRESET_PROVIDERS.find(p => p.name === selectedProvider?.name)?.docsUrl, '_blank')}
                    leftIcon={<BookOpen size={10} />}
                  >
                    Docs
                  </Button>
                )}
              </HStack>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedProvider && (
              <VStack align="stretch" spacing={4}>
                <Box p={4} bg="whiteAlpha.50" borderRadius="xl">
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" color="whiteAlpha.500">Name</Text>
                    <Text fontWeight="bold">{selectedProvider.name}</Text>
                  </VStack>
                  <Divider my={3} borderColor="whiteAlpha.100" />
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" color="whiteAlpha.500">Base URL</Text>
                    <Text fontSize="sm" fontFamily="mono">{selectedProvider.baseUrl || 'https://generativelanguage.googleapis.com'}</Text>
                  </VStack>
                  <Divider my={3} borderColor="whiteAlpha.100" />
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" color="whiteAlpha.500">API Key</Text>
                    <HStack w="full">
                      <Input 
                        size="xs" 
                        type="password" 
                        value={selectedProvider.apiKey} 
                        isReadOnly 
                        bg="blackAlpha.300"
                      />
                      <IconButton 
                        aria-label="Edit Key" 
                        icon={<Edit3 size={12} />} 
                        size="xs" 
                        onClick={() => {
                          const newKey = prompt("Enter new API Key:", selectedProvider.apiKey);
                          if (newKey !== null) {
                            updateProvider(selectedProvider.id, { apiKey: newKey });
                            toast({ title: "API Key updated", status: "success", duration: 2000 });
                          }
                        }}
                      />
                    </HStack>
                  </VStack>
                </Box>

                <Divider borderColor="whiteAlpha.100" />
                
                <VStack align="start" spacing={2}>
                  <Text fontSize="xs" fontWeight="bold" color="whiteAlpha.600">Add Manual Model</Text>
                  <HStack w="full">
                    <Input 
                      placeholder="Model ID" 
                      size="xs" 
                      value={manualModelId}
                      onChange={(e) => setManualModelId(e.target.value)}
                    />
                    <Input 
                      placeholder="Display Name" 
                      size="xs" 
                      value={manualModelName}
                      onChange={(e) => setManualModelName(e.target.value)}
                    />
                    <IconButton 
                      aria-label="Add Model" 
                      icon={<Plus size={12} />} 
                      size="xs" 
                      onClick={() => {
                        if (manualModelId && manualModelName) {
                          addManualModel(selectedProvider.id, manualModelId, manualModelName);
                          setManualModelId('');
                          setManualModelName('');
                          toast({ title: "Model added", status: "success", duration: 2000 });
                        }
                      }}
                    />
                  </HStack>
                </VStack>

                <VStack align="start" spacing={2}>
                  <Text fontSize="xs" fontWeight="bold" color="whiteAlpha.600">Available Models ({selectedProvider.availableModels?.length || 0})</Text>
                  <Box w="full" maxH="200px" overflowY="auto" bg="blackAlpha.300" borderRadius="lg" p={2} className="no-scrollbar">
                    {selectedProvider.availableModels?.length > 0 ? (
                      <VStack align="stretch" spacing={1}>
                        {selectedProvider.availableModels.map((m, i) => (
                          <HStack key={`${m.name}-${i}`} justify="space-between" p={1} _hover={{ bg: 'whiteAlpha.100' }} borderRadius="sm">
                            <Text fontSize="xs">
                              {m.displayName || m.name.split(':').pop()}
                            </Text>
                            {m.name.startsWith(selectedProvider.id) && (
                              <Badge colorScheme="blue" fontSize="8px">Manual</Badge>
                            )}
                          </HStack>
                        ))}
                      </VStack>
                    ) : (
                      <Text fontSize="xs" color="whiteAlpha.400" textAlign="center" py={4}>No models fetched yet.</Text>
                    )}
                  </Box>
                </VStack>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button size="sm" colorScheme="blue" onClick={() => { fetchModels(selectedProvider?.id); onProviderDetailClose(); }}>Fetch Models</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Versions Panel Modal */}
      <Modal isOpen={isVersionsOpen} onClose={onVersionsClose} size="md">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">Version History</ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH="400px" overflowY="auto">
            {versions.length === 0 ? (
              <Text fontSize="xs" color="whiteAlpha.400" textAlign="center" py={8}>No versions recorded yet.</Text>
            ) : (
              <VStack spacing={3} align="stretch">
                {versions?.map((v, i) => (
                  <Box 
                    key={v.id} 
                    p={3} 
                    bg="whiteAlpha.50" 
                    borderRadius="lg" 
                    cursor="pointer"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    onClick={() => { 
                      revertToVersion(v.id); 
                      onVersionsClose(); 
                      toast({ title: "Reverted to selected version", status: "success", duration: 2000 });
                    }}
                    position="relative"
                  >
                    <HStack justify="space-between">
                      <VStack align="start" spacing={0}>
                        <Text fontSize="xs" fontWeight="bold" noOfLines={1}>{v.description}</Text>
                        <Text fontSize="10px" color="whiteAlpha.500">{new Date(v.timestamp).toLocaleString()}</Text>
                      </VStack>
                      <HStack>
                        <Tooltip label="Preview this version">
                          <IconButton 
                            size="xs" 
                            icon={<Eye size={12} />} 
                            aria-label="Preview" 
                            variant="ghost" 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Temporary preview logic could go here
                              toast({ title: "Previewing version...", status: "info", duration: 1000 });
                            }} 
                          />
                        </Tooltip>
                        <ChevronRight size={14} />
                      </HStack>
                    </HStack>
                    {i === 0 && (
                      <Badge position="absolute" top={-2} right={2} colorScheme="green" fontSize="8px">Current</Badge>
                    )}
                  </Box>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="ghost" onClick={onVersionsClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Whats New Modal */}
      <Modal isOpen={isWhatsNewOpen} onClose={onWhatsNewClose} size="lg">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="#1a1a24" color="white" borderColor="whiteAlpha.200" border="1px solid">
          <ModalHeader fontSize="md">What's New in Version 2.3</ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH="500px" overflowY="auto" pb={6}>
            <VStack align="stretch" spacing={6}>
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Badge colorScheme="blue">v2.3</Badge>
                  <Text fontSize="xs" color="whiteAlpha.400">April 14, 2026</Text>
                </HStack>
                <VStack align="start" spacing={2} pl={2} borderLeft="2px solid" borderColor="blue.500">
                  <Text fontSize="xs">• Unified Provider Management: Single "+ Provider" button for all AI providers.</Text>
                  <Text fontSize="xs">• Manual Model Tagging: Models are now tied to their specific provider to avoid confusion.</Text>
                  <Text fontSize="xs">• Quick Access: Added "Get API Key" and "Docs" links for all preset providers.</Text>
                  <Text fontSize="xs">• UI Refinement: Moved mode toggles and model selection for better workflow.</Text>
                  <Text fontSize="xs">• Icon-only Tabs: Reverted Preview and Code tabs to icon-only for a cleaner look.</Text>
                </VStack>
              </Box>
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Badge colorScheme="gray">v2.2</Badge>
                  <Text fontSize="xs" color="whiteAlpha.400">April 14, 2026</Text>
                </HStack>
                <VStack align="start" spacing={2} pl={2} borderLeft="2px solid" borderColor="whiteAlpha.200">
                  <Text fontSize="xs">• Added Chat Clear/Snapshot feature to reset context safely.</Text>
                  <Text fontSize="xs">• Enhanced Chat Bubbles with timestamps and action buttons.</Text>
                  <Text fontSize="xs">• Improved AI Provider management with intelligent routing.</Text>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" colorScheme="blue" onClick={onWhatsNewClose}>Got it</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* App Footer */}
      <Box 
        as="footer" 
        w="full" 
        py={2} 
        px={4} 
        bg="#0d0d11" 
        borderTop="1px solid" 
        borderColor="whiteAlpha.100"
        position="absolute"
        bottom={0}
        left={0}
        zIndex={10}
      >
        <HStack justify="center" spacing={4}>
          <HStack spacing={1}>
            <Text fontSize="10px" color="whiteAlpha.500">Created By</Text>
            <Text 
              as="a" 
              href="https://jayreddin.github.io" 
              target="_blank" 
              fontSize="10px" 
              fontWeight="bold" 
              color="blue.400"
              _hover={{ textDecoration: 'underline' }}
            >
              Jamie Reddin
            </Text>
          </HStack>
          <Text fontSize="10px" color="whiteAlpha.400">|</Text>
          <Text 
            as="button" 
            onClick={onWhatsNewOpen}
            fontSize="10px" 
            fontWeight="bold" 
            color="whiteAlpha.600"
            _hover={{ color: 'white' }}
          >
            Version 2.2
          </Text>
        </HStack>
      </Box>
    </Flex>
  );
}