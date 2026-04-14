import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { 
  ModelType, 
  ChatMessage, 
  generateSite, 
  updateSite, 
  generateComponent, 
  listModels, 
  generateImage,
  generateSiteStream,
  updateSiteStream,
  generateComponentStream
} from '../lib/gemini';
import { MODERN_BEST_PRACTICES } from '../lib/constants';
import { generateOpenAIStream } from '../lib/openai';
import { db, auth } from '../firebase';

export type GenerationMode = 'website' | 'component';

export interface Version {
  id: string;
  html: string;
  timestamp: number;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  html: string;
  messages: ChatMessage[];
  timestamp: number;
  mode: GenerationMode;
  versions: Version[];
  isAutoSave?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  availableModels: any[];
  manualModels?: { name: string; displayName: string }[];
}

export interface AppSettings {
  theme: 'vs-dark' | 'light' | 'hc-black';
  fontSize: number;
  autoPreview: boolean;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  apiKey: string; // Legacy, keep for compatibility
  customModel: string;
  providers: AIProvider[];
  activeProviderId: string;
  favoriteModels: string[];
  showFreeOnly: boolean;
}

interface AppState {
  html: string;
  lastSavedHtml: string;
  lastAutoSaveTime: number | null;
  userInput: string;
  isLoading: boolean;
  isSaving: boolean;
  isFetchingModels: boolean;
  isGeneratingImage: boolean;
  messages: ChatMessage[];
  model: ModelType | string;
  isThinking: boolean;
  previewMode: 'desktop' | 'tablet' | 'mobile';
  activeTab: 'preview' | 'code';
  error: string | null;
  lastAction: { type: 'generate' | 'update' | 'component'; payload: string } | null;
  
  // History (Undo/Redo)
  history: string[];
  historyIndex: number;
  
  // Projects & Versions
  savedProjects: Project[];
  currentProjectId: string | null;
  generationMode: GenerationMode;
  versions: Version[];
  searchQuery: string;

  // Settings
  settings: AppSettings;
  availableModels: any[];
  providerSearchQuery: string;
  modelSearchQuery: string;
  setProviderSearchQuery: (query: string) => void;
  setModelSearchQuery: (query: string) => void;

  // Actions
  setHtml: (html: string) => void;
  setUserInput: (input: string) => void;
  setIsLoading: (loading: boolean) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setModel: (model: ModelType | string) => void;
  setIsThinking: (isThinking: boolean) => void;
  setPreviewMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  setActiveTab: (tab: 'preview' | 'code') => void;
  setError: (error: string | null) => void;
  setGenerationMode: (mode: GenerationMode) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setSearchQuery: (query: string) => void;
  
  // Complex Actions
  addMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  clearChatAndSave: () => Promise<void>;
  executeAiAction: (prompt: string) => Promise<void>;
  retryLastAction: () => Promise<void>;
  
  // History Actions
  pushToHistory: (html: string) => void;
  undo: () => void;
  redo: () => void;
  
  // Project & Version Actions
  saveProject: (name: string, isAutoSave?: boolean) => Promise<void>;
  saveProjectAs: (name: string) => Promise<void>;
  loadProject: (id: string) => void;
  copyProject: (id: string) => void;
  deleteProject: (id: string) => void;
  createVersion: (description: string) => void;
  revertToVersion: (versionId: string) => void;
  
  // API Actions
  fetchModels: (providerId?: string) => Promise<void>;
  generateImageAction: (prompt: string) => Promise<void>;
  addProvider: (provider: Omit<AIProvider, 'id' | 'availableModels'>) => Promise<void>;
  updateProvider: (id: string, provider: Partial<AIProvider>) => void;
  removeProvider: (id: string) => void;
  addManualModel: (providerId: string, modelId: string, modelName: string) => void;
  toggleFavoriteModel: (modelId: string) => void;
  optimizeCode: () => void;
  
  // Firebase Sync
  syncProject: (projectId: string) => void;
  stopSync: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      html: '',
      lastSavedHtml: '',
      lastAutoSaveTime: null,
      userInput: '',
      isLoading: false,
      isSaving: false,
      isFetchingModels: false,
      isGeneratingImage: false,
      messages: [],
      model: ModelType.FLASH,
      isThinking: false,
      previewMode: 'desktop',
      activeTab: 'preview',
      error: null,
      lastAction: null,
      history: [],
      historyIndex: -1,
      savedProjects: [],
      currentProjectId: null,
      generationMode: 'website',
      versions: [],
      searchQuery: '',
      providerSearchQuery: '',
      modelSearchQuery: '',
      setProviderSearchQuery: (providerSearchQuery) => set({ providerSearchQuery }),
      setModelSearchQuery: (modelSearchQuery) => set({ modelSearchQuery }),
      availableModels: [],
      settings: {
        theme: 'vs-dark',
        fontSize: 14,
        autoPreview: true,
        wordWrap: 'on',
        minimap: false,
        apiKey: '',
        customModel: '',
        providers: [
          { id: 'google', name: 'Google Gemini', apiKey: '', availableModels: [] }
        ],
        activeProviderId: 'google',
        favoriteModels: [ModelType.FLASH, ModelType.PRO],
        showFreeOnly: false,
      },

      setHtml: (html) => {
        set({ html });
        get().pushToHistory(html);
      },
      setUserInput: (userInput) => set({ userInput }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setMessages: (messages) => set({ messages }),
      setModel: (model) => set({ model }),
      setIsThinking: (isThinking) => set({ isThinking }),
      setPreviewMode: (previewMode) => set({ previewMode }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setError: (error) => set({ error }),
      setGenerationMode: (generationMode) => set({ generationMode }),
      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      addMessage: (msg) => set((state) => ({ 
        messages: [...state.messages, { ...msg, timestamp: msg.timestamp || Date.now() }] 
      })),
      
      clearChat: () => set({ 
        messages: [], 
        html: '', 
        error: null, 
        history: [], 
        historyIndex: -1,
        currentProjectId: null,
        versions: []
      }),

      clearChatAndSave: async () => {
        const { html, messages, currentProjectId, saveProject } = get();
        if (html || messages.length > 0) {
          await saveProject(currentProjectId ? `Snapshot before clear` : 'New Project Snapshot');
        }
        get().clearChat();
      },

      pushToHistory: (html) => {
        const { history, historyIndex } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(html);
        if (newHistory.length > 50) newHistory.shift();
        set({ 
          history: newHistory, 
          historyIndex: newHistory.length - 1 
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          set({ 
            historyIndex: newIndex, 
            html: history[newIndex] 
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          set({ 
            historyIndex: newIndex, 
            html: history[newIndex] 
          });
        }
      },

      executeAiAction: async (prompt: string) => {
        const { html, model, isThinking, generationMode, settings } = get();
        set({ isLoading: true, error: null });
        
        const actionType = generationMode === 'component' ? 'component' : (html ? 'update' : 'generate');
        set({ lastAction: { type: actionType, payload: prompt } });

        // Find the provider that owns this model
        let activeProvider = settings.providers.find(p => p.id === settings.activeProviderId);
        
        // If the model is not in the active provider, search other providers
        const modelInActive = activeProvider?.availableModels.some(m => m.name === model) || 
                             (activeProvider?.id === 'google' && [ModelType.FLASH, ModelType.PRO, ModelType.LITE].includes(model as any));
        
        if (!modelInActive) {
          const owningProvider = settings.providers.find(p => 
            p.availableModels.some(m => m.name === model)
          );
          if (owningProvider) {
            activeProvider = owningProvider;
          }
        }

        const apiKey = activeProvider?.apiKey || settings.apiKey || (import.meta as any)?.env?.VITE_GEMINI_API_KEY || undefined;

        // Add initial model message for streaming
        const modelMsg: ChatMessage = { 
          role: 'model', 
          content: '...' 
        };
        get().addMessage(modelMsg);
        const modelMsgIndex = get().messages.length - 1;

        try {
          const onChunk = (chunk: string) => {
            // Robust extraction for streaming
            let cleaned = chunk;
            const htmlMatch = chunk.match(/```html\s*([\s\S]*?)(?:```|$)/i) || chunk.match(/```\s*([\s\S]*?)(?:```|$)/i);
            
            if (htmlMatch) {
              cleaned = htmlMatch[1].trim();
            } else {
              // Try to find start of HTML if no fences yet
              const htmlStart = chunk.search(/<!DOCTYPE|<html>|<div|<nav|<section|<header|<main/i);
              if (htmlStart !== -1) {
                cleaned = chunk.substring(htmlStart).trim();
              }
            }

            set({ html: cleaned });
            
            // Update the streaming message
            const currentMessages = [...get().messages];
            if (currentMessages[modelMsgIndex]) {
              currentMessages[modelMsgIndex] = {
                ...currentMessages[modelMsgIndex],
                content: `Generating your ${generationMode}...\n\n\`\`\`html\n${cleaned.substring(0, 200)}${cleaned.length > 200 ? '...' : ''}\n\`\`\``
              };
              set({ messages: currentMessages });
            }
          };

          let finalResult = '';
          
          if (activeProvider && activeProvider.id !== 'google') {
            // Use OpenAI compatible provider
            const systemInstruction = generationMode === 'component' 
              ? `You are an expert front-end component developer. Generate a specific UI component based on the description. Output ONLY the raw HTML/CSS/JS. No markdown code fences.
              
              ${MODERN_BEST_PRACTICES}`
              : (html 
                ? `You are an expert front-end refactoring assistant. Return the ENTIRE updated HTML document. No markdown code fences.
                
                ${MODERN_BEST_PRACTICES}`
                : `You are an expert front-end web developer. Return a single complete, valid HTML5 document. No markdown code fences.
                
                ${MODERN_BEST_PRACTICES}`);

            // Strip provider tag if present
            const actualModel = typeof model === 'string' && model.includes(':') 
              ? model.split(':').slice(1).join(':') 
              : model;

            finalResult = await generateOpenAIStream(
              prompt, 
              onChunk, 
              actualModel as string, 
              apiKey || '', 
              activeProvider.baseUrl,
              systemInstruction
            );
          } else {
            // Use Google Gemini
            if (generationMode === 'component') {
              finalResult = await generateComponentStream(prompt, onChunk, model as ModelType, isThinking, apiKey);
            } else if (actionType === 'generate') {
              finalResult = await generateSiteStream(prompt, onChunk, model as ModelType, isThinking, apiKey);
            } else {
              finalResult = await updateSiteStream(html, prompt, onChunk, model as ModelType, isThinking, apiKey);
            }
          }

          // Final robust extraction
          let cleanedHtml = finalResult;
          const finalMatch = finalResult.match(/```html\s*([\s\S]*?)\s*```/i) || finalResult.match(/```\s*([\s\S]*?)\s*```/i);
          
          if (finalMatch) {
            cleanedHtml = finalMatch[1].trim();
          } else {
            const htmlStart = finalResult.search(/<!DOCTYPE|<html>/i);
            if (htmlStart !== -1) {
              cleanedHtml = finalResult.substring(htmlStart).trim();
            } else {
              // If it's a component, it might not have <html> tags
              cleanedHtml = finalResult.replace(/```html/g, '').replace(/```/g, '').trim();
            }
          }
          
          if (generationMode === 'website' && !cleanedHtml.toLowerCase().includes('<html') && !cleanedHtml.toLowerCase().includes('<!doctype')) {
            // If it's a website but missing tags, try to wrap it if it looks like content
            if (cleanedHtml.includes('<body') || cleanedHtml.includes('<div')) {
              cleanedHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <script src="https://cdn.tailwindcss.com"></script>\n  <title>Generated Site</title>\n</head>\n<body class="bg-gray-50 text-gray-900">\n  ${cleanedHtml}\n</body>\n</html>`;
            } else {
              throw new Error("The AI returned an invalid HTML structure. Please try again.");
            }
          }

          set({ 
            html: cleanedHtml, 
            isLoading: false,
            activeTab: 'preview'
          });

          // Sync to Firestore if project is active
          const { currentProjectId } = get();
          if (currentProjectId && auth.currentUser) {
            const projectRef = doc(db, 'projects', currentProjectId);
            await setDoc(projectRef, { html: cleanedHtml, timestamp: Date.now() }, { merge: true });
            
            // Add message to subcollection
            const messageRef = collection(db, 'projects', currentProjectId, 'messages');
            await addDoc(messageRef, {
              role: 'model',
              content: actionType === 'update' ? "I've updated the site." : `I've generated your ${generationMode}.`,
              timestamp: Date.now()
            });
          }

          get().pushToHistory(cleanedHtml);
          
          // Final update to the streaming message
          const finalMessages = [...get().messages];
          if (finalMessages[modelMsgIndex]) {
            finalMessages[modelMsgIndex] = {
              ...finalMessages[modelMsgIndex],
              content: actionType === 'update' ? "I've updated the site." : `I've generated your ${generationMode}.`
            };
            set({ messages: finalMessages });
          }

          get().createVersion(prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''));
        } catch (err: any) {
          console.error("AI Action Error:", err);
          let errorMessage = err.message || "An unexpected error occurred.";
          
          if (errorMessage.includes('API_KEY_INVALID')) {
            errorMessage = "Invalid API Key. Please check your settings and try again.";
          } else if (errorMessage.includes('fetch failed')) {
            errorMessage = "Network error. Please check your internet connection.";
          }

          set({ 
            error: errorMessage, 
            isLoading: false 
          });
          get().addMessage({ 
            role: 'model', 
            content: `Error: ${errorMessage}` 
          });
        }
      },

      retryLastAction: async () => {
        const { lastAction } = get();
        if (lastAction) {
          await get().executeAiAction(lastAction.payload);
        }
      },

      saveProject: async (name, isAutoSave = false) => {
        const { html, messages, savedProjects, currentProjectId, generationMode, versions } = get();
        
        set({ isSaving: true });
        const id = isAutoSave 
          ? (currentProjectId ? `${currentProjectId}-autosave` : 'autosave-latest')
          : (currentProjectId || Math.random().toString(36).substring(7));
          
        const newProject: Project = {
          id,
          name: isAutoSave ? `[Auto-save] ${name || 'Untitled'}` : name,
          html,
          messages,
          timestamp: Date.now(),
          mode: generationMode,
          versions,
          isAutoSave
        };

        // Sync to Firestore if logged in
        if (auth.currentUser && !isAutoSave) {
          const projectRef = doc(db, 'projects', id);
          await setDoc(projectRef, {
            ...newProject,
            ownerId: auth.currentUser.uid,
            collaborators: []
          }, { merge: true });
        }

        const existingIndex = savedProjects.findIndex(p => p.id === id);
        const newSavedProjects = [...savedProjects];
        
        if (existingIndex >= 0) {
          newSavedProjects[existingIndex] = newProject;
        } else {
          newSavedProjects.push(newProject);
        }

        set({ 
          savedProjects: newSavedProjects, 
          currentProjectId: isAutoSave ? currentProjectId : id,
          lastSavedHtml: isAutoSave ? get().lastSavedHtml : html,
          lastAutoSaveTime: isAutoSave ? Date.now() : get().lastAutoSaveTime,
          isSaving: false
        });
      },

      saveProjectAs: async (name) => {
        const { html, messages, savedProjects, generationMode, versions } = get();
        
        set({ isSaving: true });
        const id = Math.random().toString(36).substring(7);
          
        const newProject: Project = {
          id,
          name,
          html,
          messages,
          timestamp: Date.now(),
          mode: generationMode,
          versions,
          isAutoSave: false
        };

        // Sync to Firestore if logged in
        if (auth.currentUser) {
          const projectRef = doc(db, 'projects', id);
          await setDoc(projectRef, {
            ...newProject,
            ownerId: auth.currentUser.uid,
            collaborators: []
          }, { merge: true });
        }

        set({ 
          savedProjects: [...savedProjects, newProject], 
          currentProjectId: id,
          lastSavedHtml: html,
          isSaving: false
        });
      },

      loadProject: (id) => {
        const { savedProjects } = get();
        const project = savedProjects.find(p => p.id === id);
        if (project) {
          set({ 
            html: project.html, 
            lastSavedHtml: project.html,
            messages: project.messages, 
            currentProjectId: project.isAutoSave ? null : id,
            generationMode: project.mode,
            history: [project.html],
            historyIndex: 0,
            versions: project.versions || []
          });
        }
      },

      copyProject: (id) => {
        const { savedProjects } = get();
        const project = savedProjects.find(p => p.id === id);
        if (project) {
          const newId = Math.random().toString(36).substring(7);
          const newProject: Project = {
            ...project,
            id: newId,
            name: `${project.name} (Copy)`,
            timestamp: Date.now(),
            isAutoSave: false
          };
          set({ savedProjects: [...savedProjects, newProject] });
        }
      },

      deleteProject: (id) => {
        set((state) => ({
          savedProjects: state.savedProjects.filter(p => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
        }));
      },

      createVersion: (description) => {
        const { html, versions } = get();
        const newVersion: Version = {
          id: Math.random().toString(36).substring(7),
          html,
          timestamp: Date.now(),
          description
        };
        set({ versions: [newVersion, ...versions].slice(0, 20) });
      },

      revertToVersion: (versionId) => {
        const { versions } = get();
        const version = versions.find(v => v.id === versionId);
        if (version) {
          get().setHtml(version.html);
          get().addMessage({ role: 'model', content: `Reverted to version: ${version.description}` });
        }
      },

      fetchModels: async (providerId) => {
        const { settings } = get();
        const targetProviderId = providerId || settings.activeProviderId;
        const provider = settings.providers.find(p => p.id === targetProviderId);
        const apiKey = provider?.apiKey || settings.apiKey || undefined;

        set({ isFetchingModels: true });
        try {
          let models: any[] = [];
          
          if (provider && provider.id !== 'google' && provider.baseUrl) {
            // Fetch from custom provider via proxy to avoid CORS
            const normalizedBaseUrl = provider.baseUrl.replace(/\/+$/, '');
            let fetchUrl = `${normalizedBaseUrl}/models`;
            
            let response = await fetch('/api/proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                url: fetchUrl,
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${apiKey}`
                }
              })
            });

            // If 404, try /v1/models
            if (response.status === 404 && !normalizedBaseUrl.endsWith('/v1')) {
              const fallbackUrl = `${normalizedBaseUrl}/v1/models`;
              const fallbackResponse = await fetch('/api/proxy', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  url: fallbackUrl,
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`
                  }
                })
              });
              if (fallbackResponse.ok) {
                response = fallbackResponse;
              }
            }
            
            if (!response.ok) {
              let errorMessage = `HTTP error! status: ${response.status}`;
              try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
              } catch (e) {
                try {
                  const text = await response.text();
                  if (text) errorMessage = text;
                } catch (e2) {}
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            
            // OpenAI format usually has data array
            models = (data.data || data).map((m: any) => ({
              name: `${targetProviderId}:${m.id || m.name}`,
              displayName: m.id || m.name,
              id: m.id || m.name
            }));
          } else {
            // Use Google Gemini listModels
            try {
              const geminiModels = await listModels(apiKey);
              models = geminiModels.map((m: any) => ({
                ...m,
                name: `google:${m.name}`,
                id: m.name
              }));
            } catch (geminiErr) {
              console.warn("Failed to list Gemini models, using defaults:", geminiErr);
              // Fallback to default Gemini models if listing fails
              models = [
                { name: 'google:gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', id: 'gemini-2.0-flash' },
                { name: 'google:gemini-2.0-pro-exp-02-05', displayName: 'Gemini 2.0 Pro', id: 'gemini-2.0-pro-exp-02-05' },
                { name: 'google:gemini-2.0-flash-lite-preview-02-05', displayName: 'Gemini 2.0 Lite', id: 'gemini-2.0-flash-lite-preview-02-05' }
              ];
            }
          }
          
          set((state) => ({
            settings: {
              ...state.settings,
              providers: state.settings.providers.map(p => 
                p.id === targetProviderId ? { ...p, availableModels: models } : p
              )
            },
            availableModels: targetProviderId === settings.activeProviderId ? models : state.availableModels,
            isFetchingModels: false
          }));
        } catch (err: any) {
          console.error("Failed to fetch models:", err);
          set({ isFetchingModels: false });
          let msg = "Failed to fetch models.";
          if (err.message?.includes('API_KEY_INVALID')) msg = "Invalid API Key for this provider.";
          set({ error: msg });
        }
      },

      addProvider: async (providerData) => {
        const id = Math.random().toString(36).substring(7);
        const newProvider = { ...providerData, id, availableModels: [] };
        
        set((state) => ({
          settings: {
            ...state.settings,
            providers: [...state.settings.providers, newProvider]
          }
        }));

        // Automatically fetch models for the new provider
        await get().fetchModels(id);
      },

      removeProvider: (id) => {
        set((state) => ({
          settings: {
            ...state.settings,
            providers: state.settings.providers.filter(p => p.id !== id),
            activeProviderId: state.settings.activeProviderId === id ? 'google' : state.settings.activeProviderId
          }
        }));
      },

      updateProvider: (id, providerData) => {
        set((state) => ({
          settings: {
            ...state.settings,
            providers: state.settings.providers.map(p => 
              p.id === id ? { ...p, ...providerData } : p
            )
          }
        }));
      },

      addManualModel: (providerId, modelId, modelName) => {
        set((state) => ({
          settings: {
            ...state.settings,
            providers: state.settings.providers.map(p => {
              if (p.id === providerId) {
                const manualModels = p.manualModels || [];
                const taggedName = `${providerId}:${modelId}`;
                const newModel = { name: taggedName, displayName: modelName, id: modelId };
                
                // Check if already exists
                if (manualModels.some(m => m.name === taggedName)) return p;

                return { 
                  ...p, 
                  manualModels: [...manualModels, newModel],
                  availableModels: [...p.availableModels, newModel]
                };
              }
              return p;
            })
          }
        }));
      },

      toggleFavoriteModel: (modelId) => {
        set((state) => {
          const currentFavorites = Array.isArray(state.settings.favoriteModels) 
            ? state.settings.favoriteModels 
            : [];
          const favorites = [...currentFavorites];
          const index = favorites.indexOf(modelId);
          if (index > -1) {
            favorites.splice(index, 1);
          } else {
            favorites.push(modelId);
          }
          return {
            settings: {
              ...state.settings,
              favoriteModels: favorites
            }
          };
        });
      },

      optimizeCode: () => {
        const { html } = get();
        let optimized = html;

        // 1. Lazy loading for images
        optimized = optimized.replace(/<img\s+([^>]*?)>/gi, (match, p1) => {
          if (!p1.toLowerCase().includes('loading=')) {
            return `<img ${p1} loading="lazy">`;
          }
          return match;
        });

        // 2. Smooth scrolling
        if (!optimized.includes('scroll-behavior: smooth')) {
          const smoothScrollStyle = `\n<style>\n  html {\n    scroll-behavior: smooth;\n  }\n</style>\n`;
          if (optimized.includes('</head>')) {
            optimized = optimized.replace('</head>', `${smoothScrollStyle}</head>`);
          } else if (optimized.includes('<body>')) {
            optimized = optimized.replace('<body>', `<body>${smoothScrollStyle}`);
          } else {
            optimized = optimized + smoothScrollStyle;
          }
        }

        // 3. Scroll to Top Button (if not present)
        if (!optimized.includes('id="scroll-to-top"')) {
          const scrollToTopHtml = `
<!-- Scroll to Top Button -->
<button id="scroll-to-top" class="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg opacity-0 transition-opacity duration-300 pointer-events-none z-50">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
</button>

<script>
  (function() {
    const scrollBtn = document.getElementById('scroll-to-top');
    if (!scrollBtn) return;
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollBtn.style.opacity = '1';
        scrollBtn.style.pointerEvents = 'auto';
      } else {
        scrollBtn.style.opacity = '0';
        scrollBtn.style.pointerEvents = 'none';
      }
    });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();
</script>
`;
          if (optimized.includes('</body>')) {
            optimized = optimized.replace('</body>', `${scrollToTopHtml}</body>`);
          } else {
            optimized = optimized + scrollToTopHtml;
          }
        }

        // 4. Social Share Buttons (if not present)
        if (!optimized.includes('social-share')) {
          const socialShareHtml = `
<!-- Social Share Buttons -->
<div class="social-share fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
  <a href="#" onclick="window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(window.location.href), '_blank')" class="bg-[#1DA1F2] text-white p-2 rounded-full hover:scale-110 transition-transform">
    <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
  </a>
  <a href="#" onclick="window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href), '_blank')" class="bg-[#4267B2] text-white p-2 rounded-full hover:scale-110 transition-transform">
    <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  </a>
  <a href="#" onclick="window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(window.location.href), '_blank')" class="bg-[#0077b5] text-white p-2 rounded-full hover:scale-110 transition-transform">
    <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  </a>
</div>
`;
          if (optimized.includes('</body>')) {
            optimized = optimized.replace('</body>', `${socialShareHtml}</body>`);
          } else {
            optimized = optimized + socialShareHtml;
          }
        }

        set({ html: optimized });
        get().pushToHistory(optimized);
      },

      generateImageAction: async (prompt: string) => {
        set({ isLoading: true });
        try {
          const imageUrl = await generateImage(prompt);
          const imageHtml = `<img src="${imageUrl}" alt="${prompt}" class="w-full rounded-lg shadow-lg my-4" referrerPolicy="no-referrer" />`;
          const currentHtml = get().html;
          
          // Insert image at the end of the body or current container
          let newHtml = currentHtml;
          if (currentHtml.includes('</body>')) {
            newHtml = currentHtml.replace('</body>', `${imageHtml}</body>`);
          } else {
            newHtml += imageHtml;
          }
          
          get().setHtml(newHtml);
          get().addMessage({ role: 'model', content: `I've generated an image for: "${prompt}" and added it to the project.` });
        } catch (err: any) {
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
        }
      },

      syncProject: (projectId: string) => {
        const projectRef = doc(db, 'projects', projectId);
        
        // Listen for project changes
        const unsubscribeProject = onSnapshot(projectRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            // Only update if the local state is different to avoid loops
            if (data.html !== get().html) {
              set({ 
                html: data.html,
                currentProjectId: projectId,
                generationMode: data.mode
              });
            }
          }
        });

        // Listen for messages
        const messagesRef = collection(db, 'projects', projectId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
          const messages = snapshot.docs.map(doc => doc.data() as ChatMessage);
          if (JSON.stringify(messages) !== JSON.stringify(get().messages)) {
            set({ messages });
          }
        });

        // Store unsubscribes in a way we can call them later
        (window as any)._firebaseUnsubscribes = [unsubscribeProject, unsubscribeMessages];
      },

      stopSync: () => {
        const unsubscribes = (window as any)._firebaseUnsubscribes;
        if (unsubscribes) {
          unsubscribes.forEach((unsub: any) => unsub());
          (window as any)._firebaseUnsubscribes = null;
        }
      }
    }),
    {
      name: 'gemini-builder-storage-v3',
      partialize: (state) => ({ 
        savedProjects: state.savedProjects,
        model: state.model,
        isThinking: state.isThinking,
        settings: state.settings
      }),
      version: 5,
      migrate: (persistedState: any, version: number) => {
        const state = persistedState as any;
        
        // Ensure settings object exists
        if (!state.settings) {
          state.settings = {
            theme: 'vs-dark',
            fontSize: 14,
            autoPreview: true,
            wordWrap: 'on',
            minimap: false,
            apiKey: '',
            customModel: '',
            providers: [
              { id: 'google', name: 'Google Gemini', apiKey: '', availableModels: [] }
            ],
            activeProviderId: 'google',
            favoriteModels: [ModelType.FLASH, ModelType.PRO],
            showFreeOnly: false,
          };
          return state;
        }

        // Ensure providers exist
        if (!state.settings.providers || !Array.isArray(state.settings.providers)) {
          state.settings.providers = [
            { id: 'google', name: 'Google Gemini', apiKey: state.settings.apiKey || '', availableModels: [] }
          ];
          state.settings.activeProviderId = 'google';
        }

        // Ensure favoriteModels exist
        if (!state.settings.favoriteModels || !Array.isArray(state.settings.favoriteModels)) {
          state.settings.favoriteModels = [ModelType.FLASH, ModelType.PRO];
        }

        // Ensure showFreeOnly exists
        if (state.settings.showFreeOnly === undefined) {
          state.settings.showFreeOnly = false;
        }

        return state;
      },
    }
  )
);