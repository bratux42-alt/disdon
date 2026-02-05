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

// ============== Chats Management ==============
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function saveChats() {
    localStorage.setItem('gemini_chats', JSON.stringify(chats));
    localStorage.setItem('gemini_current_chat', currentChatId);
}

function createNewChat() {
    const newChat = {
        id: generateId(),
        title: 'Новый чат',
        messages: [],
        createdAt: Date.now()
    };

    chats.unshift(newChat);
    saveChats();
    renderChatsList();
    selectChat(newChat.id);
}

function deleteChat(chatId, event) {
    event.stopPropagation();

    chats = chats.filter(c => c.id !== chatId);

    if (currentChatId === chatId) {
        currentChatId = chats.length > 0 ? chats[0].id : null;
    }

    saveChats();
    renderChatsList();

    if (currentChatId) {
        selectChat(currentChatId);
    } else {
        createNewChat();
    }
}

function renderChatsList() {
    chatsList.innerHTML = '';

    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        chatItem.dataset.id = chat.id;

        chatItem.innerHTML = `
            <span class="chat-title">${escapeHtml(chat.title)}</span>
            <button class="delete-chat-btn" title="Удалить">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;

        chatItem.addEventListener('click', () => selectChat(chat.id));
        chatItem.querySelector('.delete-chat-btn').addEventListener('click', (e) => deleteChat(chat.id, e));

        chatsList.appendChild(chatItem);
    });
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
                history: history.slice(0, -1)
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
