# AI Gen - Documentation

AI Gen is a powerful full-stack application built with React, Vite, Chakra UI, and Firebase. It allows users to generate high-quality websites and UI components using various AI providers (Google Gemini, OpenAI, OpenRouter, etc.).

## Features

- **Multi-Provider Support**: Connect to Google Gemini, OpenAI, Anthropic, OpenRouter, and more.
- **Real-time Generation**: Watch the code being generated in real-time.
- **Live Preview**: Instantly preview the generated HTML/CSS/JS in a sandboxed iframe.
- **Project Management**: Save, load, and manage multiple projects.
- **Version Control**: Automatically create versions of your code and revert to any previous state.
- **Mobile Responsive**: Designed to work seamlessly on desktop and mobile devices.
- **Custom Models**: Add and manage custom models for any provider.
- **Image Generation**: Integrated image generation capabilities.

## Architecture

### Frontend
- **React 18**: Functional components with hooks.
- **Chakra UI**: For a polished and accessible user interface.
- **Zustand**: Lightweight state management with persistence.
- **Monaco Editor**: High-performance code editor for reviewing and editing generated code.
- **Framer Motion**: Smooth animations and transitions.

### Backend / Services
- **Firebase Firestore**: Real-time database for storing projects, messages, and versions.
- **Firebase Auth**: Secure user authentication with Google Login.
- **AI Integration**: Custom logic for streaming responses from various AI APIs.

## Getting Started

1. **Setup Firebase**: Ensure you have a valid `firebase-applet-config.json` in the root directory.
2. **Configure Providers**: Open the settings and add your API keys for the desired AI providers.
3. **Start Generating**: Describe what you want to build in the chat input and press Enter.

## Best Practices for Generation

The AI is instructed to follow modern best practices, including:
- Semantic HTML5.
- Tailwind CSS for styling.
- Accessibility (ARIA attributes).
- Performance (Lazy loading images).
- SEO (Meta tags and Schema markup).
- Social Integration (Share buttons).

## Maintenance & Optimization

- **Code Review**: Regularly review `src/store/useStore.ts` for state logic optimizations.
- **UI Updates**: Use Chakra UI's theme system for consistent styling.
- **Performance**: Monitor iframe rendering and Monaco editor performance with large codebases.

---
*Version 2.3 - April 14, 2026*
