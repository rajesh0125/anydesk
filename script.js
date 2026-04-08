// WebRTC Configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Global variables
let localPeerConnection = null;
let remotePeerConnection = null;
let localStream = null;
let remoteStream = null;
let currentRole = null;
let connectionId = null;
let isMouseControlActive = true;
let isKeyboardControlActive = true;
let remoteVideoElement = null;
let dataChannel = null;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let sessionStartTime = null;
let currentQuality = 'medium';

// Touch/Mobile variables
let isTouchMode = true;
let currentZoom = 1;
let currentPan = { x: 0, y: 0 };
let isDragging = false;
let lastTouchDistance = 0;
let touchStartPoint = null;
let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let deviceType = 'pc'; // 'pc' or 'mobile'

// File transfer variables
let activeTransfers = new Map();

// Chat variables
let chatMessages = [];

// DOM Elements
const hostIdInput = document.getElementById('hostId');
const displayHostId = document.getElementById('displayHostId');
const generateHostIdBtn = document.getElementById('generateHostId');
const remoteIdInput = document.getElementById('remoteId');
const connectBtn = document.getElementById('connectBtn');
const hostStatus = document.getElementById('hostStatus');
const clientStatus = document.getElementById('clientStatus');
const sessionView = document.getElementById('sessionView');
const remoteCanvas = document.getElementById('remoteCanvas');
const disconnectBtn = document.getElementById('disconnectBtn');
const mouseBtn = document.getElementById('mouseBtn');
const keyboardBtn = document.getElementById('keyboardBtn');
const advancedFeatures = document.getElementById('advancedFeatures');
const copyHostIdBtn = document.getElementById('copyHostId');
const showQrBtn = document.getElementById('showQrBtn');
const qrCodeDiv = document.getElementById('qrCode');
const mobileGuide = document.getElementById('mobileGuide');
const touchOverlay = document.getElementById('touchOverlay');
const touchIndicator = document.getElementById('touchIndicator');
const remoteScreenContainer = document.getElementById('remoteScreenContainer');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const touchModeBtn = document.getElementById('touchModeBtn');
const rightClickBtn = document.getElementById('rightClickBtn');
const showGesturesBtn = document.getElementById('showGesturesBtn');
const rotateBtn = document.getElementById('rotateBtn');
const virtualKeyboard = document.getElementById('virtualKeyboard');
const closeKeyboardBtn = document.getElementById('closeKeyboard');

let ctx = null;
let screenWidth = 0;
let screenHeight = 0;
let isShiftPressed = false;

if (remoteCanvas) {
    ctx = remoteCanvas.getContext('2d');
}

// Detect device type
function detectDeviceType() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) {
        return 'mobile';
    }
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return 'mobile';
    }
    return 'pc';
}

deviceType = detectDeviceType();

// Initialize mobile features
function initMobileFeatures() {
    if (deviceType === 'mobile') {
        document.body.classList.add('mobile-device');
        document.querySelector('.device-type-btn[data-device="mobile"]').click();
        mobileGuide.style.display = 'block';
        
        // Request mobile view optimization
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
        }
    }
}

// Generate QR Code for host ID
function generateQRCode(text) {
    const qrCanvas = document.getElementById('qrCanvas');
    if (qrCanvas && typeof QRCode !== 'undefined') {
        qrCanvas.innerHTML = '';
        new QRCode(qrCanvas, {
            text: text,
            width: 150,
            height: 150,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

// Show QR code
if (showQrBtn) {
    showQrBtn.addEventListener('click', () => {
        const hostId = displayHostId.textContent;
        if (hostId && hostId !== 'Not generated yet') {
            generateQRCode(hostId);
            qrCodeDiv.style.display = qrCodeDiv.style.display === 'none' ? 'block' : 'none';
        } else {
            showNotification('Please generate a host ID first', 'warning');
        }
    });
}

// Copy host ID
if (copyHostIdBtn) {
    copyHostIdBtn.addEventListener('click', () => {
        const id = displayHostId.textContent;
        if (id && id !== 'Not generated yet') {
            navigator.clipboard.writeText(id);
            showNotification('Connection ID copied!', 'success');
        }
    });
}

// Device type selector
document.querySelectorAll('.device-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.device-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        deviceType = btn.getAttribute('data-device');
        
        if (deviceType === 'mobile') {
            mobileGuide.style.display = 'block';
            isTouchMode = true;
            if (touchModeBtn) touchModeBtn.classList.add('active');
        } else {
            mobileGuide.style.display = 'none';
            isTouchMode = false;
            if (touchModeBtn) touchModeBtn.classList.remove('active');
        }
    });
});

// Touch gesture handling
function initTouchGestures() {
    if (!touchOverlay || !remoteScreenContainer) return;
    
    let initialDistance = 0;
    let initialZoom = 1;
    let startPan = { x: 0, y: 0 };
    let isTwoFingerTouch = false;
    
    // Touch start
    touchOverlay.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touches = e.touches;
        
        if (touches.length === 1) {
            // Single touch - mouse move/click
            isDragging = true;
            touchStartPoint = getTouchPoint(touches[0]);
            showTouchIndicator(touches[0].clientX, touches[0].clientY);
            
            // Start tracking for potential click
            touchStartTime = Date.now();
            
        } else if (touches.length === 2) {
            // Two finger touch - zoom/right click
            isTwoFingerTouch = true;
            initialDistance = getTouchDistance(touches[0], touches[1]);
            initialZoom = currentZoom;
            startPan = { ...currentPan };
            
            // Check for two-finger tap (right click)
            setTimeout(() => {
                if (isTwoFingerTouch && touches.length === 2) {
                    const center = getTouchCenter(touches[0], touches[1]);
                    simulateRightClick(center.x, center.y);
                    showTouchIndicator(center.x, center.y);
                }
            }, 100);
        }
    });
    
    // Touch move
    touchOverlay.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touches = e.touches;
        
        if (touches.length === 1 && isDragging) {
            // Drag to move mouse
            const point = getTouchPoint(touches[0]);
            const canvasRect = remoteCanvas.getBoundingClientRect();
            const scaleX = screenWidth / canvasRect.width;
            const scaleY = screenHeight / canvasRect.height;
            
            let x = (point.x - canvasRect.left) * scaleX;
            let y = (point.y - canvasRect.top) * scaleY;
            
            // Apply zoom/pan offset
            x = x / currentZoom;
            y = y / currentZoom;
            
            simulateMouseMove(x, y);
            
        } else if (touches.length === 2) {
            // Pinch to zoom
            const distance = getTouchDistance(touches[0], touches[1]);
            const scale = distance / initialDistance;
            let newZoom = initialZoom * scale;
            newZoom = Math.min(Math.max(0.5, newZoom), 3);
            
            if (newZoom !== currentZoom) {
                currentZoom = newZoom;
                applyZoomAndPan();
            }
        }
    });
    
    // Touch end
    touchOverlay.addEventListener('touchend', (e) => {
        const wasDragging = isDragging;
        isDragging = false;
        
        if (wasDragging && touchStartPoint && (Date.now() - touchStartTime) < 200) {
            // Single tap - left click
            const rect = remoteCanvas.getBoundingClientRect();
            const scaleX = screenWidth / rect.width;
            const scaleY = screenHeight / rect.height;
            let x = (touchStartPoint.x - rect.left) * scaleX;
            let y = (touchStartPoint.y - rect.top) * scaleY;
            
            x = x / currentZoom;
            y = y / currentZoom;
            
            simulateClick(x, y);
        }
        
        isTwoFingerTouch = false;
        touchStartPoint = null;
    });
    
    // Show touch indicator
    function showTouchIndicator(x, y) {
        if (touchIndicator) {
            touchIndicator.style.left = x + 'px';
            touchIndicator.style.top = y + 'px';
            touchIndicator.style.animation = 'none';
            setTimeout(() => {
                touchIndicator.style.animation = 'ripple 0.3s ease-out';
            }, 10);
        }
    }
    
    // Helper functions
    function getTouchPoint(touch) {
        const rect = touchOverlay.getBoundingClientRect();
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }
    
    function getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    function getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }
}

// Zoom and pan controls
function applyZoomAndPan() {
    if (!remoteScreenContainer || !remoteCanvas) return;
    
    const container = remoteScreenContainer;
    const screen = document.querySelector('.remote-screen');
    
    if (screen) {
        screen.style.transform = `translate(${currentPan.x}px, ${currentPan.y}px) scale(${currentZoom})`;
    }
}

function zoomIn() {
    currentZoom = Math.min(currentZoom + 0.2, 3);
    applyZoomAndPan();
}

function zoomOut() {
    currentZoom = Math.max(currentZoom - 0.2, 0.5);
    applyZoomAndPan();
}

function resetView() {
    currentZoom = 1;
    currentPan = { x: 0, y: 0 };
    applyZoomAndPan();
}

if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
if (resetViewBtn) resetViewBtn.addEventListener('click', resetView);

// Touch mode toggle
if (touchModeBtn) {
    touchModeBtn.addEventListener('click', () => {
        isTouchMode = !isTouchMode;
        touchModeBtn.classList.toggle('active', isTouchMode);
        if (touchOverlay) {
            touchOverlay.style.display = isTouchMode ? 'block' : 'none';
        }
        showNotification(`Touch mode ${isTouchMode ? 'enabled' : 'disabled'}`, 'info');
    });
}

// Right click button (for non-touch devices)
if (rightClickBtn) {
    rightClickBtn.addEventListener('click', () => {
        if (remoteCanvas) {
            const rect = remoteCanvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            simulateRightClick(centerX, centerY);
        }
    });
}

// Show gestures guide
if (showGesturesBtn) {
    showGesturesBtn.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="gestures"]').click();
    });
}

// Screen rotation
let rotationAngle = 0;
if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
        rotationAngle = (rotationAngle + 90) % 360;
        if (remoteCanvas) {
            remoteCanvas.style.transform = `rotate(${rotationAngle}deg)`;
        }
        showNotification(`Screen rotated ${rotationAngle}°`, 'info');
    });
}

// Virtual keyboard
function initVirtualKeyboard() {
    if (!virtualKeyboard) return;
    
    const keyboardBtn = document.getElementById('keyboardBtn');
    if (keyboardBtn) {
        keyboardBtn.addEventListener('click', () => {
            if (deviceType === 'mobile' || isTouchDevice) {
                virtualKeyboard.style.display = virtualKeyboard.style.display === 'none' ? 'block' : 'none';
            } else {
                // For PC, focus on keyboard input
                alert('For PC control, physical keyboard is recommended');
            }
        });
    }
    
    if (closeKeyboardBtn) {
        closeKeyboardBtn.addEventListener('click', () => {
            virtualKeyboard.style.display = 'none';
        });
    }
    
    // Key buttons
    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            let key = btn.getAttribute('data-key');
            if (key === 'Shift') {
                isShiftPressed = !isShiftPressed;
                btn.style.background = isShiftPressed ? '#667eea' : '#505050';
                
                // Update key labels
                document.querySelectorAll('.key-btn').forEach(k => {
                    if (k.getAttribute('data-key') && k.getAttribute('data-key').length === 1) {
                        const originalKey = k.getAttribute('data-key');
                        if (isShiftPressed) {
                            k.textContent = originalKey.toUpperCase();
                        } else {
                            k.textContent = originalKey.toLowerCase();
                        }
                    }
                });
            } else if (key === 'Space') {
                simulateKeyPress(' ');
            } else if (key === 'Backspace') {
                simulateKeyPress('Backspace');
            } else if (key === 'Enter') {
                simulateKeyPress('Enter');
            } else {
                const finalKey = isShiftPressed ? key.toUpperCase() : key.toLowerCase();
                simulateKeyPress(finalKey);
            }
        });
    });
}

// Simulate mouse events
function simulateMouseMove(x, y) {
    sendViaDataChannel({
        type: 'mouse_move',
        x: Math.round(x),
        y: Math.round(y),
        timestamp: Date.now()
    });
}

function simulateClick(x, y) {
    sendViaDataChannel({
        type: 'mouse_click',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        timestamp: Date.now()
    });
    showTouchFeedback(x, y);
}

function simulateRightClick(x, y) {
    sendViaDataChannel({
        type: 'mouse_click',
        x: Math.round(x),
        y: Math.round(y),
        button: 'right',
        timestamp: Date.now()
    });
    showNotification('Right click sent', 'info');
}

function simulateKeyPress(key) {
    sendViaDataChannel({
        type: 'key_press',
        key: key,
        shift: isShiftPressed,
        timestamp: Date.now()
    });
    showNotification(`Key: ${key}`, 'info');
}

function showTouchFeedback(x, y) {
    if (touchIndicator) {
        touchIndicator.style.left = x + 'px';
        touchIndicator.style.top = y + 'px';
        touchIndicator.style.animation = 'none';
        setTimeout(() => {
            touchIndicator.style.animation = 'ripple 0.3s ease-out';
        }, 10);
    }
}

// WebRTC Functions
async function initAsHost() {
    try {
        currentRole = 'host';
        connectionId = generateConnectionId();
        hostIdInput.value = connectionId;
        displayHostId.textContent = connectionId;
        
        // Generate QR code for mobile connection
        generateQRCode(window.location.href + '?connect=' + connectionId);
        
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor'
            },
            audio: true
        });
        
        // Get screen dimensions
        const videoTrack = localStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        screenWidth = settings.width;
        screenHeight = settings.height;
        
        localPeerConnection = new RTCPeerConnection(configuration);
        
        // Create data channel
        dataChannel = localPeerConnection.createDataChannel('remote-control');
        setupDataChannel(dataChannel);
        
        localStream.getTracks().forEach(track => {
            localPeerConnection.addTrack(track, localStream);
        });
        
        localPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                storeCandidate('host', event.candidate);
            }
        };
        
        localPeerConnection.onconnectionstatechange = () => {
            if (localPeerConnection.connectionState === 'connected') {
                updateStatus('host', 'Client connected!', 'success');
                advancedFeatures.style.display = 'block';
                sessionStartTime = Date.now();
                showNotification('Remote client connected!', 'success');
            } else if (localPeerConnection.connectionState === 'disconnected') {
                endSession();
            }
        };
        
        const offer = await localPeerConnection.createOffer();
        await localPeerConnection.setLocalDescription(offer);
        
        localStorage.setItem(`offer_${connectionId}`, JSON.stringify(offer));
        updateStatus('host', 'Host ready. Share the ID with client.', 'success');
        
        // Auto-remove after 30 minutes
        setTimeout(() => {
            if (localPeerConnection?.connectionState !== 'connected') {
                localStorage.removeItem(`offer_${connectionId}`);
            }
        }, 1800000);
        
    } catch (error) {
        console.error('Error initializing host:', error);
        updateStatus('host', 'Error: ' + error.message, 'error');
    }
}

async function connectAsClient(hostId) {
    try {
        const offerData = localStorage.getItem(`offer_${hostId}`);
        if (!offerData) {
            throw new Error('No active session found. Please check the ID.');
        }
        
        const offer = JSON.parse(offerData);
        
        remotePeerConnection = new RTCPeerConnection(configuration);
        
        remotePeerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
        
        remotePeerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            displayRemoteStream(remoteStream);
            updateStatus('client', 'Connected!', 'success');
            advancedFeatures.style.display = 'block';
            sessionView.style.display = 'block';
            sessionStartTime = Date.now();
            
            // Enable touch mode for mobile devices
            if (deviceType === 'mobile' || isTouchDevice) {
                isTouchMode = true;
                if (touchModeBtn) touchModeBtn.classList.add('active');
                if (touchOverlay) touchOverlay.style.display = 'block';
            }
        };
        
        remotePeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                storeCandidate('client', event.candidate);
            }
        };
        
        await remotePeerConnection.setRemoteDescription(offer);
        const answer = await remotePeerConnection.createAnswer();
        await remotePeerConnection.setLocalDescription(answer);
        
        updateStatus('client', 'Connected to remote host!', 'success');
        
    } catch (error) {
        console.error('Error connecting:', error);
        updateStatus('client', 'Connection failed: ' + error.message, 'error');
    }
}

function setupDataChannel(channel) {
    channel.onopen = () => {
        console.log('Data channel opened');
        showNotification('Control channel established', 'success');
    };
    
    channel.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleDataChannelMessage(data);
    };
    
    channel.onclose = () => {
        console.log('Data channel closed');
    };
}

function handleDataChannelMessage(data) {
    switch(data.type) {
        case 'mouse_move':
            // In a real implementation, this would control the remote mouse
            console.log(`Mouse move to ${data.x}, ${data.y}`);
            break;
        case 'mouse_click':
            console.log(`Mouse click at ${data.x}, ${data.y} (${data.button})`);
            if (data.button === 'right') {
                showNotification('Right click received', 'info');
            }
            break;
        case 'key_press':
            console.log(`Key press: ${data.key}`);
            showNotification(`Key pressed: ${data.key}`, 'info');
            break;
        case 'chat':
            if (window.addChatMessage) {
                window.addChatMessage(data.message);
            }
            break;
        case 'file':
            if (window.receiveFile) {
                window.receiveFile(data);
            }
            break;
        case 'ctrl_alt_del':
            showNotification('Ctrl+Alt+Del received', 'warning');
            break;
        case 'lock_screen':
            showNotification('Lock screen command received', 'info');
            break;
        case 'clipboard':
            navigator.clipboard.writeText(data.content);
            showNotification('Clipboard updated from remote', 'success');
            break;
    }
}

function displayRemoteStream(stream) {
    if (!remoteCanvas || !ctx) return;
    
    remoteVideoElement = document.createElement('video');
    remoteVideoElement.srcObject = stream;
    remoteVideoElement.autoplay = true;
    remoteVideoElement.playsInline = true;
    remoteVideoElement.muted = true;
    
    remoteVideoElement.onloadedmetadata = () => {
        screenWidth = remoteVideoElement.videoWidth;
        screenHeight = remoteVideoElement.videoHeight;
        remoteCanvas.width = screenWidth;
        remoteCanvas.height = screenHeight;
        remoteVideoElement.play();
        drawFrame();
    };
    
    function drawFrame() {
        if (remoteVideoElement && remoteVideoElement.videoWidth) {
            ctx.drawImage(remoteVideoElement, 0, 0, remoteCanvas.width, remoteCanvas.height);
        }
        requestAnimationFrame(drawFrame);
    }
}

function generateConnectionId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function updateStatus(role, message, type) {
    const statusElement = role === 'host' ? hostStatus : clientStatus;
    if (statusElement) {
        statusElement.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        statusElement.className = `status ${type}`;
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    notification.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        padding: 12px 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s;
        border-left: 4px solid ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
        max-width: 300px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function sendViaDataChannel(data) {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(data));
    } else {
        console.warn('Data channel not ready');
    }
}

function storeCandidate(role, candidate) {
    console.log(`${role} ICE candidate:`, candidate);
}

function endSession() {
    if (localPeerConnection) localPeerConnection.close();
    if (remotePeerConnection) remotePeerConnection.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (mediaRecorder && isRecording) mediaRecorder.stop();
    
    sessionView.style.display = 'none';
    advancedFeatures.style.display = 'none';
    currentRole = null;
    isRecording = false;
    
    updateStatus('host', 'Session ended', 'info');
    updateStatus('client', 'Disconnected', 'info');
}

// Initialize all features
function initAllFeatures() {
    initMobileFeatures();
    initTouchGestures();
    initVirtualKeyboard();
    initTabs();
    initChat();
    initFileTransfer();
    initWhiteboard();
    initTerminal();
    initTaskManager();
    initSettings();
    initRemoteTools();
    initKeyboardShortcuts();
}

// Tab switching
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
}

// Chat functionality
function initChat() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    const chatMessagesDiv = document.getElementById('chatMessages');
    
    function addMessage(message, type, isOwn = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'sent' : 'received'}`;
        messageDiv.innerHTML = `
            <div class="message-content">${escapeHtml(message)}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        chatMessagesDiv.appendChild(messageDiv);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
        
        if (!isOwn && document.querySelector('.tab-btn[data-tab="chat"]:not(.active)')) {
            const badge = document.getElementById('chatBadge');
            const unreadCount = (parseInt(badge.textContent) || 0) + 1;
            badge.style.display = 'inline-block';
            badge.textContent = unreadCount;
        }
    }
    
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addMessage(message, 'text', true);
            sendViaDataChannel({
                type: 'chat',
                message: message,
                timestamp: Date.now()
            });
            chatInput.value = '';
        }
    }
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
    
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (chatInput) chatInput.value += btn.textContent;
        });
    });
    
    window.addChatMessage = addMessage;
}

// File transfer functionality
function initFileTransfer() {
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseFilesBtn');
    const transferQueue = document.getElementById('transferQueue');
    
    if (dropZone) {
        dropZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }
    
    if (browseBtn && fileInput) {
        browseBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            uploadFiles(files);
        });
    }
    
    function uploadFiles(files) {
        files.forEach(file => {
            const fileId = Date.now() + '-' + Math.random();
            const transfer = {
                id: fileId,
                name: file.name,
                size: file.size,
                progress: 0,
                status: 'uploading'
            };
            activeTransfers.set(fileId, transfer);
            updateTransferQueue();
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const transfer = activeTransfers.get(fileId);
                transfer.progress = 100;
                transfer.status = 'completed';
                activeTransfers.set(fileId, transfer);
                updateTransferQueue();
                
                sendViaDataChannel({
                    type: 'file',
                    fileId: fileId,
                    fileName: file.name,
                    fileSize: file.size,
                    fileData: e.target.result
                });
                
                setTimeout(() => {
                    activeTransfers.delete(fileId);
                    updateTransferQueue();
                }, 3000);
            };
            reader.readAsDataURL(file);
            
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                const transfer = activeTransfers.get(fileId);
                if (transfer && progress <= 100) {
                    transfer.progress = progress;
                    activeTransfers.set(fileId, transfer);
                    updateTransferQueue();
                }
                if (progress >= 100) clearInterval(interval);
            }, 200);
        });
    }
    
    function updateTransferQueue() {
        if (!transferQueue) return;
        transferQueue.innerHTML = '';
        activeTransfers.forEach((transfer) => {
            const transferDiv = document.createElement('div');
            transferDiv.className = 'file-item';
            transferDiv.innerHTML = `
                <div>
                    <strong>${transfer.name}</strong>
                    <div>${formatFileSize(transfer.size)}</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${transfer.progress}%"></div>
                </div>
                <div>${transfer.progress}%</div>
            `;
            transferQueue.appendChild(transferDiv);
        });
    }
}

// Whiteboard functionality
function initWhiteboard() {
    const modal = document.getElementById('whiteboardModal');
    const whiteboardBtn = document.getElementById('whiteboardBtn');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    if (whiteboardBtn && modal) {
        whiteboardBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            initWhiteboardCanvas();
        });
        
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });
    }
    
    function initWhiteboardCanvas() {
        const canvas = document.getElementById('whiteboardCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = 400;
        
        let isDrawing = false;
        let lastX = 0, lastY = 0;
        let currentColor = '#ff0000';
        
        function draw(e) {
            if (!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            lastX = x;
            lastY = y;
        }
        
        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
            lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
        });
        
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', () => isDrawing = false);
        
        const colorPicker = document.getElementById('drawColor');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                currentColor = e.target.value;
            });
        }
        
        const clearBtn = document.getElementById('clearWhiteboard');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            });
        }
    }
}

// Terminal functionality
function initTerminal() {
    const modal = document.getElementById('terminalModal');
    const terminalBtn = document.getElementById('terminalBtn');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    if (terminalBtn && modal) {
        terminalBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
        
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });
        
        const terminalInput = document.getElementById('terminalCommand');
        const terminalOutput = document.getElementById('terminalOutput');
        
        if (terminalInput) {
            terminalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const command = terminalInput.value;
                    addTerminalOutput(`$ ${command}`);
                    simulateCommand(command);
                    terminalInput.value = '';
                }
            });
        }
        
        function addTerminalOutput(text) {
            const div = document.createElement('div');
            div.textContent = text;
            terminalOutput.appendChild(div);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
        
        function simulateCommand(command) {
            setTimeout(() => {
                if (command === 'help') {
                    addTerminalOutput('Available commands: help, list, info, clear');
                } else if (command === 'list') {
                    addTerminalOutput('Desktop\nDocuments\nDownloads\nPictures');
                } else if (command === 'info') {
                    addTerminalOutput('OS: Remote System\nUptime: ' + formatUptime());
                } else if (command === 'clear') {
                    terminalOutput.innerHTML = '';
                } else {
                    addTerminalOutput(`Command not found: ${command}`);
                }
            }, 500);
        }
    }
}

// Task Manager functionality
function initTaskManager() {
    const modal = document.getElementById('taskManagerModal');
    const taskManagerBtn = document.getElementById('taskManagerBtn');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    if (taskManagerBtn && modal) {
        taskManagerBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            updateProcessList();
        });
        
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });
    }
    
    function updateProcessList() {
        const tbody = document.querySelector('#processTable tbody');
        if (!tbody) return;
        
        const processes = [
            { pid: 1, name: 'System', cpu: 2, memory: 0.1 },
            { pid: 4, name: 'explorer.exe', cpu: 1, memory: 50 },
            { pid: 120, name: 'chrome.exe', cpu: 15, memory: 200 },
            { pid: 456, name: 'remotedesk.exe', cpu: 5, memory: 30 }
        ];
        
        tbody.innerHTML = '';
        processes.forEach(proc => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${proc.pid}</td>
                <td>${proc.name}</td>
                <td>${proc.cpu}%</td>
                <td>${proc.memory} MB</td>
                <td><button onclick="endProcess(${proc.pid})">End Task</button></td>
            `;
        });
        
        document.getElementById('cpuUsage').textContent = Math.floor(Math.random() * 100) + '%';
        document.getElementById('memoryUsage').textContent = Math.floor(Math.random() * 100) + '%';
        document.getElementById('networkUsage').textContent = Math.floor(Math.random() * 1000) + ' KB/s';
    }
    
    window.endProcess = (pid) => {
        alert(`Ending process ${pid}...`);
        updateProcessList();
    };
    
    setInterval(() => {
        if (modal && modal.style.display === 'flex') {
            updateProcessList();
        }
    }, 2000);
}

// Settings functionality
function initSettings() {
    const fpsSlider = document.getElementById('fpsSlider');
    const fpsValue = document.getElementById('fpsValue');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');
    
    if (fpsSlider && fpsValue) {
        fpsSlider.addEventListener('input', (e) => {
            fpsValue.textContent = e.target.value;
        });
    }
    
    if (qualitySlider && qualityValue) {
        qualitySlider.addEventListener('input', (e) => {
            qualityValue.textContent = e.target.value;
        });
    }
}

// Remote tools
function initRemoteTools() {
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            if (remoteCanvas) {
                const link = document.createElement('a');
                link.download = `screenshot-${Date.now()}.png`;
                link.href = remoteCanvas.toDataURL();
                link.click();
                showNotification('Screenshot saved!', 'success');
            }
        });
    }
    
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
        recordBtn.addEventListener('click', toggleRecording);
    }
    
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            const remoteView = document.querySelector('.remote-view');
            if (remoteView) {
                if (!document.fullscreenElement) {
                    remoteView.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            }
        });
    }
    
    const ctrlAltDelBtn = document.getElementById('ctrlAltDelBtn');
    if (ctrlAltDelBtn) {
        ctrlAltDelBtn.addEventListener('click', () => {
            sendViaDataChannel({
                type: 'ctrl_alt_del',
                timestamp: Date.now()
            });
            showNotification('Ctrl+Alt+Del sent', 'info');
        });
    }
    
    const clipboardBtn = document.getElementById('clipboardBtn');
    if (clipboardBtn) {
        clipboardBtn.addEventListener('click', () => {
            navigator.clipboard.readText().then(text => {
                sendViaDataChannel({
                    type: 'clipboard',
                    content: text,
                    timestamp: Date.now()
                });
                showNotification('Clipboard synced!', 'success');
            }).catch(err => {
                console.error('Failed to read clipboard:', err);
            });
        });
    }
    
    const audioBtn = document.getElementById('audioBtn');
    if (audioBtn) {
        audioBtn.addEventListener('click', () => {
            if (remoteStream) {
                const audioTracks = remoteStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    audioTracks[0].enabled = !audioTracks[0].enabled;
                    audioBtn.style.background = audioTracks[0].enabled ? '' : '#f56565';
                    showNotification(`Remote audio ${audioTracks[0].enabled ? 'enabled' : 'disabled'}`, 'info');
                }
            }
        });
    }
}

function toggleRecording() {
    if (!remoteCanvas) return;
    
    if (!isRecording) {
        const stream = remoteCanvas.captureStream(30);
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording-${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
        };
        
        mediaRecorder.start();
        isRecording = true;
        document.getElementById('recordBtn').style.background = '#f56565';
        showNotification('Recording started...', 'info');
    } else {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('recordBtn').style.background = '';
        showNotification('Recording saved!', 'success');
    }
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            document.querySelector('.tab-btn[data-tab="chat"]').click();
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            document.querySelector('.tab-btn[data-tab="files"]').click();
        }
        if (e.key === 'Escape' && document.fullscreenElement) {
            document.exitFullscreen();
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime() {
    const uptime = process.uptime ? process.uptime() : 3600;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners for main buttons
if (generateHostIdBtn) {
    generateHostIdBtn.addEventListener('click', async () => {
        if (localPeerConnection) {
            if (confirm('Start new session? Current will end.')) {
                endSession();
            } else {
                return;
            }
        }
        await initAsHost();
    });
}

if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        const hostId = remoteIdInput.value.trim().toUpperCase();
        if (!hostId) {
            updateStatus('client', 'Please enter a connection ID', 'error');
            return;
        }
        await connectAsClient(hostId);
    });
}

if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
        if (confirm('Disconnect from session?')) {
            endSession();
        }
    });
}

if (mouseBtn) {
    mouseBtn.addEventListener('click', () => {
        isMouseControlActive = !isMouseControlActive;
        mouseBtn.classList.toggle('active', isMouseControlActive);
        mouseBtn.innerHTML = isMouseControlActive ? 
            '<i class="fas fa-mouse-pointer"></i> <span class="btn-text">Mouse</span>' : 
            '<i class="fas fa-mouse-pointer"></i> <span class="btn-text">Disabled</span>';
    });
}

if (keyboardBtn) {
    keyboardBtn.addEventListener('click', () => {
        isKeyboardControlActive = !isKeyboardControlActive;
        keyboardBtn.classList.toggle('active', isKeyboardControlActive);
        keyboardBtn.innerHTML = isKeyboardControlActive ? 
            '<i class="fas fa-keyboard"></i> <span class="btn-text">Keyboard</span>' : 
            '<i class="fas fa-keyboard"></i> <span class="btn-text">Disabled</span>';
        
        if (deviceType === 'mobile' && isKeyboardControlActive && virtualKeyboard) {
            virtualKeyboard.style.display = 'block';
        }
    });
}

// Initialize everything
initAllFeatures();

// Check URL params for auto-connect
const urlParams = new URLSearchParams(window.location.search);
const connectId = urlParams.get('connect');
if (connectId && remoteIdInput) {
    remoteIdInput.value = connectId;
    setTimeout(() => {
        if (connectBtn) connectBtn.click();
    }, 1000);
}

console.log('RemoteDesk Pro initialized with mobile support!');
console.log('Device type:', deviceType);
console.log('Touch device:', isTouchDevice);