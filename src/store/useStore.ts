import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, getDoc, getDocFromServer } from 'firebase/firestore';
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
  setProviderSearchQuery: (query: string) => void;

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
  executeAiAction: (prompt: string) => Promise<void>;
  retryLastAction: () => Promise<void>;
  
  // History Actions
  pushToHistory: (html: string) => void;
  undo: () => void;
  redo: () => void;
  
  // Project & Version Actions
  saveProject: (name: string, isAutoSave?: boolean) => Promise<void>;
  loadProject: (id: string) => void;
  copyProject: (id: string) => void;
  deleteProject: (id: string) => void;
  createVersion: (description: string) => void;
  revertToVersion: (versionId: string) => void;
  
  // API Actions
  fetchModels: (providerId?: string) => Promise<void>;
  generateImageAction: (prompt: string) => Promise<void>;
  addProvider: (provider: Omit<AIProvider, 'availableModels'>) => void;
  removeProvider: (id: string) => void;
  
  // Firebase Sync
  syncProject: (projectId: string) => void;
  stopSync: () => void;
  testConnection: () => Promise<void>;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
      setProviderSearchQuery: (providerSearchQuery) => set({ providerSearchQuery }),
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

      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
      
      clearChat: () => set({ 
        messages: [], 
        html: '', 
        error: null, 
        history: [], 
        historyIndex: -1,
        currentProjectId: null,
        versions: []
      }),

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

        const activeProvider = settings.providers.find(p => p.id === settings.activeProviderId);
        const apiKey = activeProvider?.apiKey || settings.apiKey || undefined;

        // Add initial model message for streaming
        const modelMsg: ChatMessage = { 
          role: 'model', 
          content: '...' 
        };
        get().addMessage(modelMsg);
        const modelMsgIndex = get().messages.length - 1;

        try {
          const onChunk = (chunk: string) => {
            const cleaned = chunk.replace(/```html/g, '').replace(/```/g, '').trim();
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

            finalResult = await generateOpenAIStream(
              prompt, 
              onChunk, 
              model as string, 
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

          const cleanedHtml = finalResult.replace(/```html/g, '').replace(/```/g, '').trim();
          
          if (generationMode === 'website' && !cleanedHtml.startsWith('<!DOCTYPE html>') && !cleanedHtml.includes('<html')) {
            throw new Error("The AI returned an invalid HTML structure. Please try again.");
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
            try {
              await setDoc(projectRef, { html: cleanedHtml, timestamp: Date.now() }, { merge: true });
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `projects/${currentProjectId}`);
            }
            
            // Add message to subcollection
            const messageRef = collection(db, 'projects', currentProjectId, 'messages');
            try {
              await addDoc(messageRef, {
                role: 'model',
                content: actionType === 'update' ? "I've updated the site." : `I've generated your ${generationMode}.`,
                timestamp: Date.now()
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `projects/${currentProjectId}/messages`);
            }
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
          try {
            await setDoc(projectRef, {
              ...newProject,
              ownerId: auth.currentUser.uid,
              collaborators: []
            }, { merge: true });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `projects/${id}`);
          }
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
              name: m.id || m.name,
              displayName: m.id || m.name
            }));
          } else {
            // Use Google Gemini listModels
            try {
              models = await listModels(apiKey);
            } catch (geminiErr) {
              console.warn("Failed to list Gemini models, using defaults:", geminiErr);
              // Fallback to default Gemini models if listing fails
              models = [
                { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
                { name: 'gemini-2.0-pro-exp-02-05', displayName: 'Gemini 2.0 Pro' },
                { name: 'gemini-2.0-flash-lite-preview-02-05', displayName: 'Gemini 2.0 Lite' }
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

      addProvider: (provider) => {
        set((state) => ({
          settings: {
            ...state.settings,
            providers: [...state.settings.providers, { ...provider, availableModels: [] }]
          }
        }));
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
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `projects/${projectId}`);
        });

        // Listen for messages
        const messagesRef = collection(db, 'projects', projectId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
          const messages = snapshot.docs.map(doc => doc.data() as ChatMessage);
          if (JSON.stringify(messages) !== JSON.stringify(get().messages)) {
            set({ messages });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/messages`);
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
      },

      testConnection: async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration. ");
          }
          // Skip logging for other errors, as this is simply a connection test.
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
      version: 4,
      migrate: (persistedState: any, version: number) => {
        if (version < 4) {
          // Ensure settings and providers exist
          const state = persistedState as any;
          if (state.settings && !state.settings.providers) {
            state.settings.providers = [
              { id: 'google', name: 'Google Gemini', apiKey: state.settings.apiKey || '', availableModels: [] }
            ];
            state.settings.activeProviderId = 'google';
          }
          return state;
        }
        return persistedState;
      },
    }
  )
);
