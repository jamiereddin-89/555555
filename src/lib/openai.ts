
export async function generateOpenAIStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  model: string,
  apiKey: string,
  baseUrl?: string,
  systemInstruction?: string
) {
  const normalizedBaseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const targetUrl = `${normalizedBaseUrl}/chat/completions`;
  
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: targetUrl,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: {
        model: model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemInstruction || 'You are an expert web developer.' },
          { role: 'user', content: prompt }
        ],
        stream: true,
      }
    })
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch (e2) {
        // Fallback to default message
      }
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  if (!reader) throw new Error('Failed to get reader from response body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || '';
          fullText += content;
          onChunk(fullText);
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    }
  }

  return fullText;
}
