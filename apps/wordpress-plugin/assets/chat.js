document.addEventListener('DOMContentLoaded', () => {
  // Config passed from WordPress wp_localize_script
  const config = window.AskChokroConfig || { apiUrl: 'http://localhost:3000', token: '' };
  
  // Find container, or append to body if it's a global widget
  let container = document.getElementById('askchokro-chat-widget-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'askchokro-chat-widget-container';
    document.body.appendChild(container);
  }

  // Inject HTML structure
  container.innerHTML = `
    <button id="askchokro-fab" aria-label="Open AskChokro Chat">
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </button>

    <div id="askchokro-window">
      <div id="askchokro-header">
        <h3>AskChokro AI</h3>
      </div>
      <div id="askchokro-messages">
        <div class="askchokro-msg agent">
          <p>Hi there! Ask me anything about your store's data.</p>
        </div>
      </div>
      <div id="askchokro-input-area">
        <input type="text" id="askchokro-input" placeholder="Type a question..." autocomplete="off" />
        <button id="askchokro-submit" aria-label="Send">
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // UI Elements
  const fab = document.getElementById('askchokro-fab');
  const chatWindow = document.getElementById('askchokro-window');
  const msgContainer = document.getElementById('askchokro-messages');
  const input = document.getElementById('askchokro-input');
  const submitBtn = document.getElementById('askchokro-submit');

  let isOpen = false;
  let isWaiting = false;

  // Toggle Window
  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    if (isOpen) {
      fab.classList.add('open');
      chatWindow.classList.add('open');
      input.focus();
    } else {
      fab.classList.remove('open');
      chatWindow.classList.remove('open');
    }
  });

  // Handle Input
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isWaiting && input.value.trim() !== '') {
      sendMessage(input.value.trim());
    }
  });

  submitBtn.addEventListener('click', () => {
    if (!isWaiting && input.value.trim() !== '') {
      sendMessage(input.value.trim());
    }
  });

  function addMessage(text, sender, meta = null) {
    const el = document.createElement('div');
    el.className = \`askchokro-msg \${sender}\`;
    
    // Convert newlines to breaks for simple formatting
    const formattedText = text.replace(/\\n/g, '<br/>');
    el.innerHTML = \`<p>\${formattedText}</p>\`;

    if (meta && meta.sql) {
      const metaEl = document.createElement('div');
      metaEl.className = 'sql-meta';
      metaEl.textContent = \`Query: \${meta.sql}\`;
      el.appendChild(metaEl);
    }

    msgContainer.appendChild(el);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return el;
  }

  function addTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'askchokro-typing';
    el.id = 'askchokro-typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgContainer.appendChild(el);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('askchokro-typing-indicator');
    if (el) el.remove();
  }

  async function sendMessage(text) {
    // Optimistic UI update
    input.value = '';
    addMessage(text, 'user');
    isWaiting = true;
    submitBtn.disabled = true;
    addTypingIndicator();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (config.token) {
        headers['Authorization'] = \`Bearer \${config.token}\`;
      }

      // Try streaming endpoint first
      const response = await fetch(\`\${config.apiUrl}/api/ask/stream\`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: text })
      });

      removeTypingIndicator();

      if (!response.ok) {
        throw new Error('API Error: ' + response.statusText);
      }

      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        // Handle SSE Stream manually
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let agentMsgEl = addMessage('', 'agent');
        let currentText = '';
        
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunkString = decoder.decode(value, { stream: true });
          const lines = chunkString.split('\\n\\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.error) {
                  agentMsgEl.innerHTML += \`<br/><span style="color:red">Error: \${data.error}</span>\`;
                } else if (data.content) {
                  currentText += data.content;
                  agentMsgEl.innerHTML = \`<p>\${currentText.replace(/\\n/g, '<br/>')}</p>\`;
                }
                
                if (data.done && data.metadata) {
                  if (data.metadata.sql) {
                    const metaEl = document.createElement('div');
                    metaEl.className = 'sql-meta';
                    metaEl.textContent = \`Query: \${data.metadata.sql}\`;
                    agentMsgEl.appendChild(metaEl);
                  }
                }
                msgContainer.scrollTop = msgContainer.scrollHeight;
              } catch (e) {
                console.error("Error parsing stream chunk", e, line);
              }
            }
          }
        }
      } else {
        // Fallback to standard JSON response
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        addMessage(data.answer, 'agent', { sql: data.sql });
      }

    } catch (error) {
      removeTypingIndicator();
      addMessage(\`Sorry, something went wrong: \${error.message}\`, 'agent');
    } finally {
      isWaiting = false;
      submitBtn.disabled = false;
      input.focus();
    }
  }
});
