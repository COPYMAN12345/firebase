// Firebase Configuration
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

// DOM Elements
const elements = {
    chatBox: document.getElementById('chatBox'),
    messageInput: document.getElementById('messageInput'),
    peerIdInput: document.getElementById('peerIdInput'),
    localVideo: document.getElementById('localVideo'),
    remoteVideo: document.getElementById('remoteVideo'),
    peerIdDisplay: document.getElementById('peerIdDisplay')
};

// Initialize buttons
const buttons = [
    'sendButton', 'connectButton', 'disconnectButton',
    'callButton', 'endCallButton', 'muteButton',
    'pauseVideoButton', 'clearChatButton'
].forEach(id => {
    elements[id] = document.getElementById(id);
});

// Global State
const state = {
    peer: null,
    conn: null,
    username: '',
    localStream: null,
    currentCall: null,
    isMuted: false,
    isVideoPaused: false
};

// Initialize App
function initializeApp() {
    auth.signInAnonymously()
        .then(() => {
            const username = prompt('Enter your name:') || 'Anonymous';
            const peerId = prompt('Enter your Peer ID:') || `user-${Math.random().toString(36).substr(2, 8)}`;
            
            if (!username || !peerId) {
                alert("Both name and peer ID are required");
                return;
            }
            
            state.username = username;
            initializePeer(peerId);
        })
        .catch(error => {
            console.error("Auth error:", error);
        });
}

// PeerJS Initialization
function initializePeer(peerId) {
    state.peer = new Peer(peerId, {
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    state.peer.on('open', id => {
        elements.peerIdDisplay.textContent = `Your Peer ID: ${id}`;
    });

    state.peer.on('error', error => {
        console.error('PeerJS error:', error);
    });

    state.peer.on('call', async call => {
        try {
            if (!state.localStream) {
                state.localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                elements.localVideo.srcObject = state.localStream;
            }
            
            call.answer(state.localStream);
            
            call.on('stream', remoteStream => {
                elements.remoteVideo.srcObject = remoteStream;
            });
            
            state.currentCall = call;
        } catch (error) {
            console.error("Call answer error:", error);
        }
    });

    state.peer.on('connection', connection => {
        state.conn = connection;
        setupConnectionListeners();
    });
}

// Connection Handlers
function setupConnectionListeners() {
    state.conn.on('open', () => {
        appendMessage(`Connected to ${state.conn.peer}`, 'system');
    });

    state.conn.on('data', data => {
        appendMessage(`${data.username}: ${data.message}`, 'remote');
    });

    state.conn.on('close', () => {
        appendMessage('Disconnected', 'system');
        endVideoCall();
    });
}

// Video Call Functions
async function startVideoCall() {
    if (!state.conn) {
        alert("Not connected to any peer");
        return;
    }

    try {
        state.localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        elements.localVideo.srcObject = state.localStream;
        
        const call = state.peer.call(state.conn.peer, state.localStream);
        
        call.on('stream', remoteStream => {
            elements.remoteVideo.srcObject = remoteStream;
        });
        
        state.currentCall = call;
    } catch (error) {
        console.error("Call failed:", error);
    }
}

function endVideoCall() {
    if (state.currentCall) {
        state.currentCall.close();
    }
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        elements.localVideo.srcObject = null;
    }
    elements.remoteVideo.srcObject = null;
    state.currentCall = null;
    state.localStream = null;
}

// Chat Functions
function appendMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    elements.chatBox.appendChild(messageElement);
    elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
}

function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || !state.conn) return;
    
    state.conn.send({ 
        username: state.username, 
        message: message 
    });
    appendMessage(`${state.username}: ${message}`, 'local');
    elements.messageInput.value = '';
}

// Event Listeners
elements.connectButton.addEventListener('click', () => {
    const peerId = elements.peerIdInput.value.trim();
    if (!peerId || peerId === state.peer?.id) return;
    
    state.conn = state.peer.connect(peerId);
    setupConnectionListeners();
});

elements.sendButton.addEventListener('click', sendMessage);
elements.messageInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

elements.callButton.addEventListener('click', startVideoCall);
elements.endCallButton.addEventListener('click', endVideoCall);

elements.muteButton.addEventListener('click', () => {
    if (state.localStream) {
        state.isMuted = !state.isMuted;
        state.localStream.getAudioTracks().forEach(track => {
            track.enabled = !state.isMuted;
        });
        elements.muteButton.textContent = state.isMuted ? 'Unmute' : 'Mute';
    }
});

elements.pauseVideoButton.addEventListener('click', () => {
    if (state.localStream) {
        state.isVideoPaused = !state.isVideoPaused;
        state.localStream.getVideoTracks().forEach(track => {
            track.enabled = !state.isVideoPaused;
        });
        elements.pauseVideoButton.textContent = state.isVideoPaused ? 'Resume Video' : 'Pause Video';
    }
});

elements.clearChatButton.addEventListener('click', () => {
    elements.chatBox.innerHTML = '';
});

elements.disconnectButton.addEventListener('click', () => {
    if (state.conn) {
        state.conn.close();
        state.conn = null;
    }
    endVideoCall();
});

// Start the application
initializeApp();
