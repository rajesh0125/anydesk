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
let idleTimer = null;
let currentQuality = 'medium';

// File transfer variables
let activeTransfers = new Map();
let receivedFiles = [];

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
const sessionStatus = document.getElementById('sessionStatus');
const advancedFeatures = document.getElementById('advancedFeatures');
const copyHostIdBtn = document.getElementById('copyHostId');

let ctx = null;
if (remoteCanvas) {
    ctx = remoteCanvas.getContext('2d');
}

// Initialize all advanced features
function initAdvancedFeatures() {
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
        
        // Store message
        chatMessages.push({ message, type, timestamp: Date.now(), isOwn });
        
        // Update badge
        if (!isOwn && document.querySelector('.tab-btn[data-tab="chat"]:not(.active)')) {
            const badge = document.getElementById('chatBadge');
            const unreadCount = chatMessages.filter(m => !m.isOwn).length;
            if (unreadCount > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = unreadCount;
            }
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
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Emoji buttons
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            chatInput.value += btn.textContent;
            chatInput.focus();
        });
    });
    
    window.addChatMessage = (message) => {
        addMessage(message, 'text', false);
    };
}

// File transfer functionality
function initFileTransfer() {
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseFilesBtn');
    const transferQueue = document.getElementById('transferQueue');
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        uploadFiles(files);
    });
    
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        uploadFiles(Array.from(e.target.files));
    });
    
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
            
            // Simulate file transfer
            simulateFileTransfer(file, fileId);
        });
    }
    
    function simulateFileTransfer(file, fileId) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const transfer = activeTransfers.get(fileId);
            transfer.progress = 100;
            transfer.status = 'completed';
            activeTransfers.set(fileId, transfer);
            updateTransferQueue();
            
            // Send file data via data channel
            sendViaDataChannel({
                type: 'file',
                fileId: fileId,
                fileName: file.name,
                fileSize: file.size,
                fileData: e.target.result
            });
            
            // Remove after 3 seconds
            setTimeout(() => {
                activeTransfers.delete(fileId);
                updateTransferQueue();
            }, 3000);
        };
        reader.readAsDataURL(file);
        
        // Simulate progress
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
    }
    
    function updateTransferQueue() {
        if (!transferQueue) return;
        transferQueue.innerHTML = '';
        activeTransfers.forEach((transfer, id) => {
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
    
    window.receiveFile = (data) => {
        receivedFiles.push(data);
        updateReceivedFiles();
        
        // Auto-download
        const link = document.createElement('a');
        link.href = data.fileData;
        link.download = data.fileName;
        link.click();
    };
    
    function updateReceivedFiles() {
        const receivedDiv = document.getElementById('receivedFiles');
        if (!receivedDiv) return;
        receivedDiv.innerHTML = '';
        receivedFiles.slice(-5).forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-item';
            fileDiv.innerHTML = `
                <div>
                    <strong>${file.fileName}</strong>
                    <div>${formatFileSize(file.fileSize)}</div>
                </div>
                <button onclick="downloadFile('${file.fileId}')">Download</button>
            `;
            receivedDiv.appendChild(fileDiv);
        });
    }
}

// Whiteboard functionality
function initWhiteboard() {
    const modal = document.getElementById('whiteboardModal');
    const whiteboardBtn = document.getElementById('whiteboardBtn');
    const closeBtns = document.querySelectorAll('.close-modal');
    const canvas = document.getElementById('whiteboardCanvas');
    let isDrawing = false;
    let currentTool = 'pen';
    let currentColor = '#ff0000';
    
    if (whiteboardBtn) {
        whiteboardBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            initWhiteboardCanvas();
        });
    }
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });
    
    function initWhiteboardCanvas() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = 400;
        
        let lastX = 0, lastY = 0;
        
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
        canvas.addEventListener('mouseleave', () => isDrawing = false);
        
        // Tool selection
        document.querySelectorAll('.draw-tool').forEach(tool => {
            tool.addEventListener('click', () => {
                currentTool = tool.getAttribute('data-tool');
            });
        });
        
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
    const terminalInput = document.getElementById('terminalCommand');
    const terminalOutput = document.getElementById('terminalOutput');
    
    if (terminalBtn) {
        terminalBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });
    
    if (terminalInput) {
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const command = terminalInput.value;
                addTerminalOutput(`$ ${command}`);
                
                // Simulate command execution
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

// Task Manager functionality
function initTaskManager() {
    const modal = document.getElementById('taskManagerModal');
    const taskManagerBtn = document.getElementById('taskManagerBtn');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    if (taskManagerBtn) {
        taskManagerBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            updateProcessList();
        });
    }
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });
    
    function updateProcessList() {
        const tbody = document.querySelector('#processTable tbody');
        if (!tbody) return;
        
        // Simulate process list
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
        
        // Update stats
        document.getElementById('cpuUsage').textContent = Math.floor(Math.random() * 100) + '%';
        document.getElementById('memoryUsage').textContent = Math.floor(Math.random() * 100) + '%';
        document.getElementById('networkUsage').textContent = Math.floor(Math.random() * 1000) + ' KB/s';
    }
    
    window.endProcess = (pid) => {
        alert(`Ending process ${pid}...`);
        updateProcessList();
    };
    
    setInterval(() => {
        if (modal.style.display === 'flex') {
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
    
    if (fpsSlider) {
        fpsSlider.addEventListener('input', (e) => {
            fpsValue.textContent = e.target.value;
        });
    }
    
    if (qualitySlider) {
        qualitySlider.addEventListener('input', (e) => {
            qualityValue.textContent = e.target.value;
            adjustQuality(e.target.value);
        });
    }
    
    const idleTimeout = document.getElementById('idleTimeout');
    if (idleTimeout) {
        idleTimeout.addEventListener('change', (e) => {
            setupIdleTimer(e.target.value);
        });
    }
}

// Remote tools functionality
function initRemoteTools() {
    // Screenshot
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', takeScreenshot);
    }
    
    // Recording
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
        recordBtn.addEventListener('click', toggleRecording);
    }
    
    // Fullscreen
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // Quality
    const qualityBtn = document.getElementById('qualityBtn');
    const qualitySelect = document.getElementById('qualitySelect');
    if (qualityBtn) {
        qualityBtn.addEventListener('click', () => {
            qualitySelect.style.display = qualitySelect.style.display === 'none' ? 'block' : 'none';
        });
    }
    if (qualitySelect) {
        qualitySelect.addEventListener('change', (e) => {
            currentQuality = e.target.value;
            adjustQuality(currentQuality);
        });
    }
    
    // Ctrl+Alt+Del
    const ctrlAltDelBtn = document.getElementById('ctrlAltDelBtn');
    if (ctrlAltDelBtn) {
        ctrlAltDelBtn.addEventListener('click', () => {
            sendCtrlAltDel();
        });
    }
    
    // Lock Screen
    const lockScreenBtn = document.getElementById('lockScreenBtn');
    if (lockScreenBtn) {
        lockScreenBtn.addEventListener('click', () => {
            lockRemoteScreen();
        });
    }
    
    // Clipboard sync
    const clipboardBtn = document.getElementById('clipboardBtn');
    if (clipboardBtn) {
        clipboardBtn.addEventListener('click', syncClipboard);
    }
    
    // Audio
    const audioBtn = document.getElementById('audioBtn');
    if (audioBtn) {
        audioBtn.addEventListener('click', toggleRemoteAudio);
    }
    
    // Mobile view
    const mobileViewBtn = document.getElementById('mobileViewBtn');
    if (mobileViewBtn) {
        mobileViewBtn.addEventListener('click', toggleMobileView);
    }
}

// Keyboard shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+C for chat
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            document.querySelector('.tab-btn[data-tab="chat"]').click();
        }
        // Ctrl+Shift+F for file transfer
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            document.querySelector('.tab-btn[data-tab="files"]').click();
        }
        // Esc to exit fullscreen
        if (e.key === 'Escape' && document.fullscreenElement) {
            document.exitFullscreen();
        }
    });
}

// Helper functions
function takeScreenshot() {
    if (!remoteCanvas) return;
    const link = document.createElement('a');
    link.download = `screenshot-${Date.now()}.png`;
    link.href = remoteCanvas.toDataURL();
    link.click();
    showNotification('Screenshot saved!', 'success');
}

function toggleRecording() {
    if (!remoteCanvas) return;
    
    if (!isRecording) {
        const stream = remoteCanvas.captureStream(30);
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm'
        });
        
        recordedChunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
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

function toggleFullscreen() {
    const remoteView = document.querySelector('.remote-view');
    if (!document.fullscreenElement) {
        remoteView.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function adjustQuality(quality) {
    if (typeof quality === 'string') {
        switch(quality) {
            case 'high':
                remoteCanvas.style.imageRendering = 'auto';
                break;
            case 'medium':
                remoteCanvas.style.imageRendering = 'smooth';
                break;
            case 'low':
                remoteCanvas.style.imageRendering = 'pixelated';
                break;
        }
    } else {
        const qualityPercent = quality / 100;
        // Adjust canvas rendering quality
        if (qualityPercent < 0.5) {
            remoteCanvas.style.imageRendering = 'pixelated';
        } else {
            remoteCanvas.style.imageRendering = 'smooth';
        }
    }
}

function sendCtrlAltDel() {
    sendViaDataChannel({
        type: 'ctrl_alt_del',
        timestamp: Date.now()
    });
    showNotification('Ctrl+Alt+Del sent to remote device', 'info');
}

function lockRemoteScreen() {
    sendViaDataChannel({
        type: 'lock_screen',
        timestamp: Date.now()
    });
    showNotification('Lock screen command sent', 'info');
}

function syncClipboard() {
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
}

function toggleRemoteAudio() {
    const audioBtn = document.getElementById('audioBtn');
    if (remoteStream) {
        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            audioBtn.style.background = audioTracks[0].enabled ? '' : '#f56565';
            showNotification(`Remote audio ${audioTracks[0].enabled ? 'enabled' : 'disabled'}`, 'info');
        } else {
            showNotification('No audio stream available', 'warning');
        }
    }
}

function toggleMobileView() {
    const remoteCanvas = document.getElementById('remoteCanvas');
    remoteCanvas.style.width = window.innerWidth < 768 ? '100%' : '';
    remoteCanvas.style.height = 'auto';
    showNotification('Mobile view optimized', 'success');
}

function setupIdleTimer(minutes) {
    if (idleTimer) clearTimeout(idleTimer);
    
    let idleTime = 0;
    const resetTimer = () => {
        idleTime = 0;
    };
    
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    
    idleTimer = setInterval(() => {
        idleTime++;
        if (idleTime >= minutes) {
            showNotification('Session ended due to inactivity', 'warning');
            endSession();
        }
    }, 60000);
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
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s;
        border-left: 4px solid ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sendViaDataChannel(data) {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(data));
    } else {
        console.warn('Data channel not ready');
    }
}

// Original WebRTC functions (keep from previous version)
async function initAsHost() {
    try {
        currentRole = 'host';
        connectionId = generateConnectionId();
        hostIdInput.value = connectionId;
        displayHostId.textContent = connectionId;
        
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });
        
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
            } else if (localPeerConnection.connectionState === 'disconnected') {
                endSession();
            }
        };
        
        const offer = await localPeerConnection.createOffer();
        await localPeerConnection.setLocalDescription(offer);
        
        localStorage.setItem(`offer_${connectionId}`, JSON.stringify(offer));
        updateStatus('host', 'Host ready. Share the ID with client.', 'success');
        
    } catch (error) {
        console.error('Error initializing host:', error);
        updateStatus('host', 'Error: ' + error.message, 'error');
    }
}

function setupDataChannel(channel) {
    channel.onopen = () => {
        console.log('Data channel opened');
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
            showNotification('Ctrl+Alt+Del received', 'info');
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

async function connectAsClient(hostId) {
    try {
        const offerData = localStorage.getItem(`offer_${hostId}`);
        if (!offerData) {
            throw new Error('No active session found');
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

function displayRemoteStream(stream) {
    if (!remoteCanvas || !ctx) return;
    
    remoteVideoElement = document.createElement('video');
    remoteVideoElement.srcObject = stream;
    remoteVideoElement.autoplay = true;
    remoteVideoElement.playsInline = true;
    remoteVideoElement.muted = true;
    
    remoteVideoElement.onloadedmetadata = () => {
        remoteVideoElement.play();
        drawFrame();
    };
    
    function drawFrame() {
        if (remoteVideoElement && remoteVideoElement.videoWidth) {
            remoteCanvas.width = remoteVideoElement.videoWidth;
            remoteCanvas.height = remoteVideoElement.videoHeight;
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

function storeCandidate(role, candidate) {
    // Store for signaling (simplified for demo)
    console.log(`${role} ICE candidate:`, candidate);
}

// Copy host ID
if (copyHostIdBtn) {
    copyHostIdBtn.addEventListener('click', () => {
        const id = displayHostId.textContent;
        navigator.clipboard.writeText(id);
        showNotification('Connection ID copied!', 'success');
    });
}

// Connect button
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

// Generate host ID
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

// Disconnect button
if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
        if (confirm('Disconnect from session?')) {
            endSession();
        }
    });
}

// Mouse and keyboard controls
if (mouseBtn) {
    mouseBtn.addEventListener('click', () => {
        isMouseControlActive = !isMouseControlActive;
        mouseBtn.classList.toggle('active', isMouseControlActive);
        mouseBtn.innerHTML = isMouseControlActive ? 
            '<i class="fas fa-mouse-pointer"></i> Mouse Active' : 
            '<i class="fas fa-mouse-pointer"></i> Mouse Disabled';
    });
}

if (keyboardBtn) {
    keyboardBtn.addEventListener('click', () => {
        isKeyboardControlActive = !isKeyboardControlActive;
        keyboardBtn.classList.toggle('active', isKeyboardControlActive);
        keyboardBtn.innerHTML = isKeyboardControlActive ? 
            '<i class="fas fa-keyboard"></i> Keyboard Active' : 
            '<i class="fas fa-keyboard"></i> Keyboard Disabled';
    });
}

// Initialize everything
initAdvancedFeatures();

console.log('RemoteDesk Pro initialized with advanced features!');