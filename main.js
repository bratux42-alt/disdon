// ============== State ==============
let currentUser = null;
let currentChatId = null;
let accessToken = null;
let refreshToken = null;
let chats = [];

// ============== DOM Elements ==============
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');
const authError = document.getElementById('auth-error');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const sidebar = document.getElementById('sidebar');
const chatsList = document.getElementById('chats-list');
const newChatBtn = document.getElementById('new-chat-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const sidebarToggle = document.getElementById('sidebar-toggle');

let isSignUp = false;

// ============== Init ==============
function init() {
    // Load saved session
    const savedToken = localStorage.getItem('access_token');
    const savedRefresh = localStorage.getItem('refresh_token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
        accessToken = savedToken;
        refreshToken = savedRefresh;
        currentUser = JSON.parse(savedUser);
        showApp();
        loadChats();
    } else {
        showAuthModal();
    }

    setupEventListeners();
}

function setupEventListeners() {
    // Auth
    authForm.addEventListener('submit', handleAuth);
    authSwitchLink.addEventListener('click', toggleAuthMode);
    logoutBtn.addEventListener('click', logout);

    // Chat
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

    // Sidebar
    newChatBtn.addEventListener('click', createNewChat);
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

// ============== Auth ==============
function showAuthModal() {
    authModal.style.display = 'flex';
    sidebar.style.display = 'none';
}

function hideAuthModal() {
    authModal.style.display = 'none';
}

function showApp() {
    hideAuthModal();
    sidebar.style.display = 'flex';
    userEmailSpan.textContent = currentUser?.email || '';
}

function toggleAuthMode(e) {
    e.preventDefault();
    isSignUp = !isSignUp;
    authTitle.textContent = isSignUp ? 'Регистрация' : 'Вход';
    authSubmit.textContent = isSignUp ? 'Зарегистрироваться' : 'Войти';
    authSwitchText.textContent = isSignUp ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
    authSwitchLink.textContent = isSignUp ? 'Войти' : 'Регистрация';
    authError.textContent = '';
}

async function handleAuth(e) {
    e.preventDefault();
    authError.textContent = '';
    authSubmit.disabled = true;

    const email = authEmail.value.trim();
    const password = authPassword.value;

    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: isSignUp ? 'signup' : 'signin',
                email,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Ошибка аутентификации');
        }

        if (data.session?.access_token) {
            accessToken = data.session.access_token;
            refreshToken = data.session.refresh_token;
            currentUser = data.user;

            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
            localStorage.setItem('user', JSON.stringify(currentUser));

            showApp();
            loadChats();
        } else if (data.message) {
            authError.textContent = data.message;
            authError.style.color = '#00ff88';
        }
    } catch (err) {
        authError.textContent = err.message;
        authError.style.color = '#ff4444';
    } finally {
        authSubmit.disabled = false;
    }
}

function logout() {
    accessToken = null;
    refreshToken = null;
    currentUser = null;
    currentChatId = null;
    chats = [];

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    chatsList.innerHTML = '';
    clearChatHistory();
    showAuthModal();
}

// ============== Chats ==============
async function loadChats() {
    try {
        const res = await fetch('/api/chats', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();

        if (res.ok && data.chats) {
            chats = data.chats;
            renderChatsList();

            // Select first chat or create one
            if (chats.length > 0) {
                selectChat(chats[0].id);
            } else {
                createNewChat();
            }
        }
    } catch (err) {
        console.error('Error loading chats:', err);
    }
}

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

async function createNewChat() {
    try {
        const res = await fetch('/api/chats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ title: 'Новый чат' })
        });

        const data = await res.json();
        if (res.ok && data.chat) {
            chats.unshift(data.chat);
            renderChatsList();
            selectChat(data.chat.id);
        }
    } catch (err) {
        console.error('Error creating chat:', err);
    }
}

async function deleteChat(chatId) {
    if (!confirm('Удалить этот чат?')) return;

    try {
        await fetch('/api/chats', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ chat_id: chatId })
        });

        chats = chats.filter(c => c.id !== chatId);
        renderChatsList();

        if (currentChatId === chatId) {
            if (chats.length > 0) {
                selectChat(chats[0].id);
            } else {
                currentChatId = null;
                clearChatHistory();
            }
        }
    } catch (err) {
        console.error('Error deleting chat:', err);
    }
}

function selectChat(chatId) {
    currentChatId = chatId;

    // Update UI
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === chatId);
    });

    // Close sidebar on mobile
    sidebar.classList.remove('open');

    // Load messages (for now just clear)
    clearChatHistory();
    addMessage('Добро пожаловать. Я Gemini, ваш персональный ИИ помощник. Как я могу помочь вам сегодня?', 'system');
}

// ============== Messages ==============
function clearChatHistory() {
    chatHistory.innerHTML = '';
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    if (!currentChatId) {
        alert('Выберите или создайте чат');
        return;
    }

    userInput.value = '';
    userInput.style.height = 'auto';
    addMessage(text, 'user');

    const loadingMessage = addLoadingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                message: text,
                chat_id: currentChatId
            })
        });

        const data = await res.json();
        chatHistory.removeChild(loadingMessage);

        if (data.response) {
            addMessage(data.response, 'ai');

            // Update chat title in sidebar if it was "Новый чат"
            const chatIndex = chats.findIndex(c => c.id === currentChatId);
            if (chatIndex !== -1 && chats[chatIndex].title === 'Новый чат') {
                const newTitle = text.substring(0, 50) + (text.length > 50 ? '...' : '');
                chats[chatIndex].title = newTitle;
                renderChatsList();
            }
        } else if (data.error) {
            addMessage(`Ошибка: ${data.error}`, 'ai');
        }
    } catch (error) {
        if (loadingMessage.parentNode) chatHistory.removeChild(loadingMessage);
        addMessage(`Ошибка сети: ${error.message}`, 'ai');
    }
}

function addMessage(text, sender) {
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
