import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { MODERN_BEST_PRACTICES } from "./constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export enum ModelType {
  FLASH = "gemini-3-flash-preview",
  PRO = "gemini-3.1-pro-preview",
  LITE = "gemini-3.1-flash-lite-preview",
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  timestamp?: number;
}

export async function generateImage(description: string): Promise<string> {
  // Simulated Imagen integration using a high-quality AI image service
  const encodedPrompt = encodeURIComponent(description);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
}

function getClient(apiKey?: string) {
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function generateSiteStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  modelType: ModelType | string = ModelType.FLASH,
  isThinking: boolean = false,
  apiKey?: string
) {
  const client = getClient(apiKey);
  const actualModel = typeof modelType === 'string' && modelType.includes(':') 
    ? modelType.split(':').slice(1).join(':') 
    : modelType;

  const systemInstruction = `You are an expert front-end web developer. 
You ALWAYS return a single complete, valid HTML5 document with inline CSS (Tailwind via CDN is preferred) and vanilla JavaScript.
NEVER use markdown code fences. NEVER explain your code. 
Output ONLY the raw HTML starting with <!DOCTYPE html>.
Ensure the design is modern, responsive, and accessible.

${MODERN_BEST_PRACTICES}`;

  const result = await client.models.generateContentStream({
    model: actualModel,
    contents: `Generate a full website based on this description: ${prompt}`,
    config: {
      systemInstruction,
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      ...(isThinking && modelType === ModelType.PRO ? {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      } : {})
    },
  });

  let fullText = "";
  for await (const chunk of result) {
    const text = chunk.text;
    fullText += text;
    onChunk(fullText);
  }

  return fullText;
}

export async function updateSiteStream(
  currentHtml: string,
  instruction: string,
  onChunk: (chunk: string) => void,
  modelType: ModelType | string = ModelType.FLASH,
  isThinking: boolean = false,
  apiKey?: string
) {
  const client = getClient(apiKey);
  const actualModel = typeof modelType === 'string' && modelType.includes(':') 
    ? modelType.split(':').slice(1).join(':') 
    : modelType;

  const systemInstruction = `You are an expert front-end refactoring assistant.
The user will provide a full HTML document and a change request.
You MUST return the ENTIRE updated HTML document.
NEVER use markdown code fences. NEVER explain your changes.
Output ONLY the raw HTML.
Preserve all existing functionality unless explicitly asked to change it.
Refactor the code to follow modern best practices if it doesn't already.

${MODERN_BEST_PRACTICES}`;

  const prompt = `CURRENT HTML:
${currentHtml}

CHANGE REQUEST:
${instruction}

Return the full updated HTML:`;

  const result = await client.models.generateContentStream({
    model: actualModel,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.4,
      ...(isThinking && modelType === ModelType.PRO ? {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      } : {})
    },
  });

  let fullText = "";
  for await (const chunk of result) {
    const text = chunk.text;
    fullText += text;
    onChunk(fullText);
  }

  return fullText;
}

export async function generateComponentStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  modelType: ModelType | string = ModelType.FLASH,
  isThinking: boolean = false,
  apiKey?: string
) {
  const client = getClient(apiKey);
  const actualModel = typeof modelType === 'string' && modelType.includes(':') 
    ? modelType.split(':').slice(1).join(':') 
    : modelType;

  const systemInstruction = `You are an expert front-end component developer.
Generate a specific UI component (e.g., a button, card, form, navigation bar) based on the description.
The output should be a standalone HTML snippet with necessary CSS (Tailwind via CDN) and JS.
NEVER use markdown code fences. NEVER explain your code.
Output ONLY the raw HTML/CSS/JS.
Ensure the component is modular, accessible, and follows modern best practices.

${MODERN_BEST_PRACTICES}`;

  const result = await client.models.generateContentStream({
    model: actualModel,
    contents: `Generate a UI component based on this description: ${prompt}`,
    config: {
      systemInstruction,
      temperature: 0.7,
      ...(isThinking && modelType === ModelType.PRO ? {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      } : {})
    },
  });

  let fullText = "";
  for await (const chunk of result) {
    const text = chunk.text;
    fullText += text;
    onChunk(fullText);
  }

  return fullText;
}

export async function generateSite(
  prompt: string,
  modelType: ModelType | string = ModelType.FLASH,
  isThinking: boolean = false,
  apiKey?: string
) {
  const client = getClient(apiKey);
  const systemInstruction = `You are an expert front-end web developer. 
You ALWAYS return a single complete, valid HTML5 document with inline CSS (Tailwind via CDN is preferred) and vanilla JavaScript.
NEVER use markdown code fences. NEVER explain your code. 
Output ONLY the raw HTML starting with <!DOCTYPE html>.
Ensure the design is modern, responsive, and accessible.

${MODERN_BEST_PRACTICES}`;

  const response = await client.models.generateContent({
    model: modelType,
    contents: `Generate a full website based on this description: ${prompt}`,
    config: {
      systemInstruction,
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      ...(isThinking && modelType === ModelType.PRO ? {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      } : {})
    },
  });

  return response.text || "";
}

export async function updateSite(
  currentHtml: string,
  instruction: string,
  modelType: ModelType | string = ModelType.FLASH,
  isThinking: boolean = false,
  apiKey?: string
) {
  const client = getClient(apiKey);
  const systemInstruction = `You are an expert front-end refactoring assistant.
The user will provide a full HTML document and a change request.
You MUST return the ENTIRE updated HTML document.
NEVER use markdown code fences. NEVER explain your changes.
Output ONLY the raw HTML.
Preserve all existing functionality unless explicitly asked to change it.
Refactor the code to follow modern best practices if it doesn't already.

${MODERN_BEST_PRACTICES}`;

  const prompt = `CURRENT HTML:
${currentHtml}

CHANGE REQUEST:
${instruction}

Return the full updated HTML:`;

  const response = await client.models.generateContent({
    model: modelType,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.4,
      ...(isThinking && modelType === ModelType.PRO ? {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      } : {})
    },
  });

  return response.text || "";
}

export async function generateComponent(
  prompt: string,
  modelType: ModelType | string = ModelType.FLASH,
  isThinking: boolean = false,
  apiKey?: string
) {
  const client = getClient(apiKey);
  const systemInstruction = `You are an expert front-end component developer.
Generate a specific UI component (e.g., a button, card, form, navigation bar) based on the description.
The output should be a standalone HTML snippet with necessary CSS (Tailwind via CDN) and JS.
NEVER use markdown code fences. NEVER explain your code.
Output ONLY the raw HTML/CSS/JS.
Ensure the component is modular, accessible, and follows modern best practices.

${MODERN_BEST_PRACTICES}`;

  const response = await client.models.generateContent({
    model: modelType,
    contents: `Generate a UI component based on this description: ${prompt}`,
    config: {
      systemInstruction,
      temperature: 0.7,
      ...(isThinking && modelType === ModelType.PRO ? {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      } : {})
    },
  });

  return response.text || "";
}

export async function listModels(apiKey?: string) {
  const client = getClient(apiKey);
  const response = await client.models.list();
  // The response is a Pager, which is iterable. Convert it to an array.
  const models = [];
  for await (const model of response) {
    models.push(model);
  }
  return models;
}
