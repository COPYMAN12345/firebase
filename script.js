// ===== Firebase Configuration =====
const firebaseConfig = {
    apiKey: "AIzaSyAX8HA_J5nzCYanV6nowelPnhORArhJuGw",
    authDomain: "chat-and-video-call-v-1.firebaseapp.com",
    databaseURL: "https://chat-and-video-call-v-1.firebaseio.com",
    projectId: "chat-and-video-call-v-1",
    storageBucket: "chat-and-video-call-v-1.appspot.com",
    messagingSenderId: "649653147053",
    appId: "1:649653147053:web:0bfb4e2488b67a99043d24",
    measurementId: "G-SBN3DDHR35"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ===== DOM Elements =====
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const peerIdInput = document.getElementById('peerIdInput');
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const peerIdDisplay = document.getElementById('peerIdDisplay');
const callButton = document.getElementById('callButton');
const endCallButton = document.getElementById('endCallButton');
const muteButton = document.getElementById('muteButton');
const pauseVideoButton = document.getElementById('pauseVideoButton');
const clearChatButton = document.getElementById('clearChatButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// ===== Global Variables =====
let peer;
let conn;
let username;
let localStream;
let currentCall;
let isMuted = false;
let isVideoPaused = false;

// ===== Initialize the Application =====
function initializeApp() {
    // Sign in anonymously
    auth.signInAnonymously()
        .then(() => {
            console.log("Signed in anonymously");
            promptUserForDetails();
        })
        .catch((error) => {
            console.error("Authentication error:", error);
            alert("Failed to initialize authentication. Please refresh the page.");
        });
}

function promptUserForDetails() {
    username = prompt('Enter your name:') || 'Anonymous';
    const peerId = prompt('Enter your Peer ID:') || `user-${Math.random().toString(36).substr(2, 8)}`;
    
    if (!username || !peerId) {
        alert("Both name and peer ID are required. Please refresh the page.");
        return;
    }
    
    initializePeer(peerId);
}

// ===== PeerJS Initialization =====
function initializePeer(customId) {
    peer = new Peer(customId);

    peer.on('open', (id) => {
        peerIdDisplay.textContent = `Your Peer ID: ${id}`;
    });

    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        alert('Connection error occurred. Please check console for details.');
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnectionListeners();
    });
}

function setupConnectionListeners() {
    conn.on('open', () => {
        appendMessage(`Connected to ${conn.peer}`, 'system');
        loadChatHistory();
    });

    conn.on('data', (data) => {
        appendMessage(`${data.username}: ${data.message}`, data.username === username ? 'local' : 'remote');
    });

    conn.on('close', () => {
        appendMessage('Connection closed', 'system');
    });

    conn.on('error', (error) => {
        console.error('Connection error:', error);
        appendMessage('Connection error', 'system');
    });
}

// ===== Video Call Functions =====
async function startVideoCall() {
    try {
        if (!conn || !conn.open) {
            alert('Not connected to any peer.');
            return;
        }

        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        const call = peer.call(conn.peer, localStream);
        call.on('stream', (remoteStream) => {
            remoteVideo.srcObject = remoteStream;
        });
        
        call.on('close', endVideoCall);
        currentCall = call;
    } catch (error) {
        console.error("Failed to start call:", error);
        alert("Failed to access camera/microphone. Please check permissions.");
    }
}

function endVideoCall() {
    if (currentCall) {
        currentCall.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
    }
    currentCall = null;
    localStream = null;
}

function toggleMute() {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
    }
}

function toggleVideo() {
    if (localStream) {
        isVideoPaused = !isVideoPaused;
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !isVideoPaused;
        });
        pauseVideoButton.textContent = isVideoPaused ? 'Resume Video' : 'Pause Video';
    }
}

// ===== Chat Functions =====
function getChatId() {
    if (!conn) return null;
    const peers = [peer.id, conn.peer].sort();
    return peers.join('_');
}

function appendMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    // Format message with username styling
    const colonIndex = message.indexOf(':');
    if (colonIndex > -1) {
        const usernamePart = message.substring(0, colonIndex + 1);
        const messagePart = message.substring(colonIndex + 1);
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.textContent = usernamePart;
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = messagePart;
        
        messageElement.appendChild(usernameSpan);
        messageElement.appendChild(messageSpan);
    } else {
        messageElement.textContent = message;
    }
    
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (type !== 'system' && conn) {
        saveMessageToFirebase(message, type);
    }
}

function saveMessageToFirebase(message, type) {
    const chatRef = database.ref(`chats/${getChatId()}`);
    const messageData = {
        username: type === 'local' ? username : conn.peer,
        message: message.split(': ')[1] || message,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        type: type
    };
    
    chatRef.push(messageData)
        .catch(error => {
            console.error("Failed to save message:", error);
        });
}

function loadChatHistory() {
    const chatId = getChatId();
    if (!chatId) return;

    const chatRef = database.ref(`chats/${chatId}`).orderByChild('timestamp');
    
    chatRef.on('value', (snapshot) => {
        chatBox.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const { username, message, type } = childSnapshot.val();
            appendMessage(`${username}: ${message}`, type);
        });
    }, (error) => {
        console.error("Failed to load chat history:", error);
    });
}

function clearChat() {
    chatBox.innerHTML = '';
}

// ===== Event Listeners =====
connectButton.addEventListener('click', () => {
    const peerId = peerIdInput.value.trim();
    if (!peerId) {
        alert('Please enter a Peer ID!');
        return;
    }
    
    if (peerId === peer.id) {
        alert("You can't connect to yourself!");
        return;
    }
    
    conn = peer.connect(peerId);
    setupConnectionListeners();
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) {
        alert("Message can't be empty!");
        return;
    }
    
    if (!conn || !conn.open) {
        alert("Not connected to any peer!");
        return;
    }
    
    try {
        conn.send({ username, message });
        appendMessage(`${username}: ${message}`, 'local');
        messageInput.value = '';
    } catch (error) {
        console.error("Failed to send message:", error);
        alert("Failed to send message. Please check connection.");
    }
}

disconnectButton.addEventListener('click', () => {
    if (conn) {
        conn.close();
        conn = null;
        appendMessage('Disconnected', 'system');
    }
    endVideoCall();
});

clearChatButton.addEventListener('click', clearChat);
callButton.addEventListener('click', startVideoCall);
endCallButton.addEventListener('click', endVideoCall);
muteButton.addEventListener('click', toggleMute);
pauseVideoButton.addEventListener('click', toggleVideo);

// Start the application
initializeApp();