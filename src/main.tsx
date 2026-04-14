import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import App from './App.tsx';
import './index.css';

// Suppress ResizeObserver loop limit exceeded error
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('ResizeObserver loop completed with undelivered notifications')) {
      return;
    }
    originalError.apply(console, args);
  };

  window.addEventListener('error', (e) => {
    if (e.message === 'ResizeObserver loop completed with undelivered notifications' ||
        e.message === 'ResizeObserver loop limit exceeded') {
      const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
      if (resizeObserverErrDiv) {
        resizeObserverErrDiv.style.display = 'none';
      }
      e.stopImmediatePropagation();
    }
  });
}

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: '#e6f0ff',
      100: '#b3d1ff',
      200: '#80b3ff',
      300: '#4d94ff',
      400: '#1a75ff',
      500: '#005ce6',
      600: '#0047b3',
      700: '#003380',
      800: '#001f4d',
      900: '#000a1a',
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);