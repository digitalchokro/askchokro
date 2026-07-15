document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('askchokro-chat-container');
  if (!container) return;

  const messagesDiv = document.getElementById('askchokro-messages');
  const inputEl = document.getElementById('askchokro-input');
  const sendBtn = document.getElementById('askchokro-send-btn');

  // get settings from WordPress localized script
  const { microserviceUrl, apiToken } = window.askchokroData || {};

  function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = isUser ? 'askchokro-message user' : 'askchokro-message bot';
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return msgDiv;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    if (!microserviceUrl) {
      addMessage('Error: AskChokro microservice URL is not configured.', false);
      return;
    }

    addMessage(text, true);
    inputEl.value = '';
    const botMsg = addMessage('Thinking...', false);

    try {
      const response = await fetch(microserviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ question: text })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // If streaming, handle stream... for now we handle simple JSON
      const data = await response.json();
      botMsg.textContent = data.answer || JSON.stringify(data.rows, null, 2) || 'Done.';
    } catch (e) {
      botMsg.textContent = 'Error: ' + e.message;
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
});
