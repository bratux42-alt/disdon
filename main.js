// ============== State ==============
let chats = JSON.parse(localStorage.getItem('gemini_chats') || '[]');
let currentChatId = localStorage.getItem('gemini_current_chat') || null;

// ============== DOM Elements ==============
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const sidebar = document.getElementById('sidebar');
const chatsList = document.getElementById('chats-list');
const newChatBtn = document.getElementById('new-chat-btn');
const sidebarToggle = document.getElementById('sidebar-toggle');

// ============== Init ==============
function init() {
    if (chats.length === 0) {
        createNewChat();
    } else {
        renderChatsList();
        if (currentChatId && chats.find(c => c.id === currentChatId)) {
            selectChat(currentChatId);
        } else {
            selectChat(chats[0].id);
        }
    }

    setupEventListeners();
}

function setupEventListeners() {
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });

    newChatBtn.addEventListener('click', createNewChat);
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

function saveChats() {
    localStorage.setItem('gemini_chats', JSON.stringify(chats));
    localStorage.setItem('gemini_current_chat', currentChatId);
}

// ============== Chats ==============
function renderChatsList() {
    chatsList.innerHTML = '';
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
        item.dataset.id = chat.id;

        item.innerHTML = `
            <span class="chat-title">${escapeHtml(chat.title)}</span>
            <button class="delete-chat-btn" title="Удалить">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;

        item.querySelector('.chat-title').addEventListener('click', () => selectChat(chat.id));
        item.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        chatsList.appendChild(item);
    });
}

function createNewChat() {
    const chat = {
        id: 'chat_' + Date.now(),
        title: 'Новый чат',
        messages: []
    };
    chats.unshift(chat);
    saveChats();
    renderChatsList();
    selectChat(chat.id);
}

function deleteChat(chatId) {
    if (chats.length === 1) {
        alert('Нельзя удалить последний чат');
        return;
    }

    chats = chats.filter(c => c.id !== chatId);
    saveChats();
    renderChatsList();

    if (currentChatId === chatId) {
        selectChat(chats[0].id);
    }
}

function selectChat(chatId) {
    currentChatId = chatId;
    saveChats();

    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === chatId);
    });

    sidebar.classList.remove('open');

    // Render messages
    const chat = chats.find(c => c.id === chatId);
    renderMessages(chat);
}

function renderMessages(chat) {
    chatHistory.innerHTML = '';

    // Welcome message
    addMessageToUI('Добро пожаловать. Я Gemini, ваш персональный ИИ помощник. Как я могу помочь вам сегодня?', 'system');

    // Chat messages
    if (chat && chat.messages) {
        chat.messages.forEach(msg => {
            addMessageToUI(msg.content, msg.role === 'user' ? 'user' : 'ai');
        });
    }
}

// ============== Messages ==============
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    userInput.style.height = 'auto';

    // Add user message
    addMessageToUI(text, 'user');

    // Save to chat
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages.push({ role: 'user', content: text });

        // Update title if first message
        if (chat.messages.length === 1) {
            chat.title = text.substring(0, 40) + (text.length > 40 ? '...' : '');
            renderChatsList();
        }
        saveChats();
    }

    const loadingMessage = addLoadingIndicator();

    try {
        // Send with history for context
        const history = chat ? chat.messages.map(m => ({
            role: m.role,
            content: m.content
        })) : [];

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: history.slice(0, -1) // Exclude current message, already included
            })
        });

        const data = await res.json();
        chatHistory.removeChild(loadingMessage);

        if (data.response) {
            addMessageToUI(data.response, 'ai');

            // Save AI response
            if (chat) {
                chat.messages.push({ role: 'model', content: data.response });
                saveChats();
            }
        } else if (data.error) {
            addMessageToUI(`Ошибка: ${data.error}`, 'ai');
        }
    } catch (error) {
        if (loadingMessage.parentNode) chatHistory.removeChild(loadingMessage);
        addMessageToUI(`Ошибка сети: ${error.message}`, 'ai');
    }
}

function addMessageToUI(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    bubble.innerHTML = formattedText;
    messageDiv.appendChild(bubble);
    chatHistory.appendChild(messageDiv);
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start
init();
