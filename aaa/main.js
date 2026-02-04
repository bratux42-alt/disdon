// Frontend JavaScript - calls local Python server
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Auto-resize textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';

    // Add user message to UI
    addMessage(text, 'user');

    // Show loading state
    const loadingMessage = addLoadingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        const data = await response.json();
        chatHistory.removeChild(loadingMessage);

        if (data.response) {
            addMessage(data.response, 'ai');
        } else if (data.error) {
            console.error('API Error:', data.error);
            addMessage(`Ошибка: ${data.error}`, 'ai');
        } else {
            addMessage('Извините, получен неожиданный ответ.', 'ai');
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        if (loadingMessage.parentNode) chatHistory.removeChild(loadingMessage);
        addMessage(`Ошибка сети: ${error.message}. Убедитесь, что сервер запущен.`, 'ai');
    }
}

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Simple markdown-ish support for line breaks and bold
    const formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    bubble.innerHTML = formattedText;

    messageDiv.appendChild(bubble);
    chatHistory.appendChild(messageDiv);

    // Scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function addLoadingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai loading';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = `
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    messageDiv.appendChild(bubble);
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return messageDiv;
}

sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
