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
const themeToggle = document.getElementById('theme-toggle');
const themeMenu = document.getElementById('theme-menu');

// ============== Init ==============
function init() {
    // Load theme
    const savedTheme = localStorage.getItem('gemini_theme') || 'default';
    applyTheme(savedTheme);

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

    // Theme Selector
    themeToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        themeMenu.classList.toggle('hidden');
    });

    document.querySelectorAll('.theme-menu button').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            applyTheme(theme);
            themeMenu.classList.add('hidden');
        });
    });

    document.addEventListener('click', () => {
        themeMenu?.classList.add('hidden');
    });
}

function applyTheme(theme) {
    document.body.className = theme === 'default' ? '' : `theme-${theme}`;
    localStorage.setItem('gemini_theme', theme);
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
function formatMessage(text) {
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    userInput.style.height = 'auto';

    // Add user message
    addMessageToUI(text, 'user');

    // Save to chat
    const chat = chats.find(c => c.id === currentChatId);
    let history = [];

    if (chat) {
        // Prepare history for backend (before adding current message)
        history = chat.messages.map(m => ({
            role: m.role,
            content: m.content
        }));

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
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: history
            })
        });

        const contentType = res.headers.get('Content-Type') || '';
        const responseText = await res.text();

        // Remove loading indicator
        if (loadingMessage.parentNode) chatHistory.removeChild(loadingMessage);

        if (!res.ok) {
            // Error response (JSON)
            try {
                const errData = JSON.parse(responseText);
                throw new Error(errData.error || res.statusText);
            } catch (parseErr) {
                throw new Error(responseText || res.statusText);
            }
        }

        // Parse response: plain text or legacy JSON
        let aiFullResponse = '';
        if (contentType.includes('application/json')) {
            // Legacy JSON format fallback
            const data = JSON.parse(responseText);
            aiFullResponse = data.response || responseText;
        } else {
            // New plain text format
            aiFullResponse = responseText;
        }

        // Create AI message bubble with typing animation
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        messageDiv.appendChild(bubble);
        chatHistory.appendChild(messageDiv);

        // Typing animation
        await typeMessage(bubble, aiFullResponse);

        // Save AI response
        if (chat) {
            chat.messages.push({ role: 'model', content: aiFullResponse });
            saveChats();
        }

    } catch (error) {
        if (loadingMessage.parentNode) chatHistory.removeChild(loadingMessage);
        addMessageToUI(`Ошибка: ${error.message}`, 'ai');
    }
}

async function typeMessage(bubble, fullText) {
    const chars = [...fullText];
    let displayed = '';
    const chunkSize = 3; // characters per tick
    const delay = 15; // ms between ticks

    for (let i = 0; i < chars.length; i += chunkSize) {
        displayed += chars.slice(i, i + chunkSize).join('');
        bubble.innerHTML = formatMessage(displayed);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        await new Promise(r => setTimeout(r, delay));
    }
    // Ensure full text is displayed
    bubble.innerHTML = formatMessage(fullText);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function addMessageToUI(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    bubble.innerHTML = formatMessage(text);
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
