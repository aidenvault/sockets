/**
 * WebSocket Demo Client
 * Interactive client for testing WebSocket API server
 */

class WebSocketDemoClient {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.isConnected = false;
        this.channels = new Set();
        this.autoScroll = true;

        this.initializeElements();
        this.attachEventListeners();
        this.updatePayloadTemplate();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Connection elements
        this.wsUrlInput = document.getElementById('ws-url');
        this.authTokenInput = document.getElementById('auth-token');
        this.connectBtn = document.getElementById('connect-btn');
        this.disconnectBtn = document.getElementById('disconnect-btn');

        // Status elements
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');
        this.clientIdDisplay = document.getElementById('client-id');

        // Message composer
        this.messageTypeSelect = document.getElementById('message-type');
        this.messagePayloadTextarea = document.getElementById('message-payload');
        this.sendMessageBtn = document.getElementById('send-message-btn');

        // Channels
        this.channelNameInput = document.getElementById('channel-name');
        this.joinChannelBtn = document.getElementById('join-channel-btn');
        this.leaveChannelBtn = document.getElementById('leave-channel-btn');
        this.channelsList = document.getElementById('channels-list');

        // Log
        this.logContent = document.getElementById('log-content');
        this.clearLogBtn = document.getElementById('clear-log-btn');
        this.autoScrollCheckbox = document.getElementById('auto-scroll');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Connection
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());

        // Quick actions
        document.querySelectorAll('.btn-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Message composer
        this.messageTypeSelect.addEventListener('change', () => this.updatePayloadTemplate());
        this.sendMessageBtn.addEventListener('click', () => this.sendCustomMessage());

        // Channels
        this.joinChannelBtn.addEventListener('click', () => this.joinChannel());
        this.leaveChannelBtn.addEventListener('click', () => this.leaveChannel());
        this.channelNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChannel();
        });

        // Log
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
        this.autoScrollCheckbox.addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });

        // Enter key to send message
        this.messagePayloadTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.sendCustomMessage();
            }
        });
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        const url = this.wsUrlInput.value.trim();
        const token = this.authTokenInput.value.trim();

        if (!url) {
            this.log('ERROR', 'WebSocket URL is required', 'error');
            return;
        }

        const wsUrl = token ? `${url}?token=${token}` : url;

        this.log('INFO', `Connecting to ${url}...`);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => this.handleOpen();
            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onerror = (error) => this.handleError(error);
            this.ws.onclose = (event) => this.handleClose(event);
        } catch (error) {
            this.log('ERROR', `Failed to connect: ${error.message}`, 'error');
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }

    /**
     * Handle WebSocket open event
     */
    handleOpen() {
        this.isConnected = true;
        this.updateConnectionUI(true);
        this.log('INFO', 'Connected to WebSocket server', 'received');
    }

    /**
     * Handle incoming WebSocket message
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.log('RECEIVED', JSON.stringify(message, null, 2), 'received');

            // Handle special message types
            if (message.type === 'CONNECTED') {
                this.clientId = message.payload.clientId;
                this.clientIdDisplay.textContent = `Client ID: ${this.clientId}`;
            } else if (message.type === 'SUBSCRIBED') {
                this.channels.add(message.payload.channel);
                this.updateChannelsList();
            } else if (message.type === 'UNSUBSCRIBED') {
                this.channels.delete(message.payload.channel);
                this.updateChannelsList();
            }
        } catch (error) {
            this.log('ERROR', `Failed to parse message: ${error.message}`, 'error');
        }
    }

    /**
     * Handle WebSocket error
     */
    handleError(error) {
        this.log('ERROR', `WebSocket error: ${error.message || 'Unknown error'}`, 'error');
    }

    /**
     * Handle WebSocket close event
     */
    handleClose(event) {
        this.isConnected = false;
        this.clientId = null;
        this.channels.clear();
        this.updateConnectionUI(false);
        this.updateChannelsList();
        this.log('INFO', `Disconnected (Code: ${event.code}, Reason: ${event.reason || 'None'})`);
    }

    /**
     * Send message to server
     */
    send(message) {
        if (!this.isConnected || !this.ws) {
            this.log('ERROR', 'Not connected to server', 'error');
            return;
        }

        try {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            this.log('SENT', JSON.stringify(message, null, 2), 'sent');
        } catch (error) {
            this.log('ERROR', `Failed to send message: ${error.message}`, 'error');
        }
    }

    /**
     * Handle quick action buttons
     */
    handleQuickAction(action) {
        if (!this.isConnected) {
            this.log('ERROR', 'Not connected to server', 'error');
            return;
        }

        switch (action) {
            case 'ping':
                this.send({ type: 'PING' });
                break;

            case 'stats':
                this.send({ type: 'GET_STATS' });
                break;

            case 'broadcast':
                const broadcastMessage = prompt('Enter broadcast message:');
                if (broadcastMessage) {
                    this.send({
                        type: 'BROADCAST',
                        payload: { message: broadcastMessage }
                    });
                }
                break;

            case 'inference':
                const inferenceInput = prompt('Enter inference input:');
                if (inferenceInput) {
                    this.send({
                        type: 'INFERENCE_REQUEST',
                        payload: { input: inferenceInput },
                        requestId: this.generateId()
                    });
                }
                break;
        }
    }

    /**
     * Send custom message from composer
     */
    sendCustomMessage() {
        if (!this.isConnected) {
            this.log('ERROR', 'Not connected to server', 'error');
            return;
        }

        const messageType = this.messageTypeSelect.value;
        const payloadText = this.messagePayloadTextarea.value.trim();

        try {
            let message;

            if (messageType === 'custom') {
                // Parse entire JSON
                message = JSON.parse(payloadText);
            } else {
                // Build message with type and payload
                message = { type: messageType };

                if (payloadText) {
                    message.payload = JSON.parse(payloadText);
                }

                // Add request ID for tracking
                message.requestId = this.generateId();
            }

            this.send(message);
        } catch (error) {
            this.log('ERROR', `Invalid JSON: ${error.message}`, 'error');
        }
    }

    /**
     * Update payload template based on selected message type
     */
    updatePayloadTemplate() {
        const messageType = this.messageTypeSelect.value;
        const templates = {
            'PING': '',
            'BROADCAST': '{\n  "message": "Hello, everyone!"\n}',
            'DIRECT_MESSAGE': '{\n  "targetClientId": "client-id-here",\n  "message": "Hello!"\n}',
            'ROOM_MESSAGE': '{\n  "channel": "general",\n  "message": "Hello, room!"\n}',
            'SUBSCRIBE': '{\n  "channel": "general"\n}',
            'UNSUBSCRIBE': '{\n  "channel": "general"\n}',
            'INFERENCE_REQUEST': '{\n  "input": "Your input here",\n  "model": "default"\n}',
            'GET_STATS': '',
            'GET_CONNECTIONS': '',
            'custom': '{\n  "type": "CUSTOM_TYPE",\n  "payload": {}\n}'
        };

        this.messagePayloadTextarea.value = templates[messageType] || '';
    }

    /**
     * Join a channel
     */
    joinChannel() {
        const channel = this.channelNameInput.value.trim();
        if (!channel) {
            this.log('ERROR', 'Channel name is required', 'error');
            return;
        }

        this.send({
            type: 'SUBSCRIBE',
            payload: { channel },
            requestId: this.generateId()
        });

        this.channelNameInput.value = '';
    }

    /**
     * Leave a channel
     */
    leaveChannel() {
        const channel = this.channelNameInput.value.trim();
        if (!channel) {
            this.log('ERROR', 'Channel name is required', 'error');
            return;
        }

        this.send({
            type: 'UNSUBSCRIBE',
            payload: { channel },
            requestId: this.generateId()
        });

        this.channelNameInput.value = '';
    }

    /**
     * Update channels list display
     */
    updateChannelsList() {
        if (this.channels.size === 0) {
            this.channelsList.innerHTML = '<p class="muted">No channels joined</p>';
        } else {
            this.channelsList.innerHTML = Array.from(this.channels)
                .map(channel => `<span class="channel-tag"># ${channel}</span>`)
                .join('');
        }
    }

    /**
     * Log message to console
     */
    log(direction, content, type = '') {
        const timestamp = new Date().toLocaleTimeString();
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        entry.innerHTML = `
            <div class="timestamp">${timestamp}</div>
            <span class="direction ${type}">${direction}</span>
            <div class="content">${this.escapeHtml(content)}</div>
        `;

        this.logContent.appendChild(entry);

        if (this.autoScroll) {
            this.logContent.scrollTop = this.logContent.scrollHeight;
        }

        // Limit log entries to 100
        while (this.logContent.children.length > 100) {
            this.logContent.removeChild(this.logContent.firstChild);
        }
    }

    /**
     * Clear log
     */
    clearLog() {
        this.logContent.innerHTML = '<p class="muted">Log cleared</p>';
    }

    /**
     * Update connection UI state
     */
    updateConnectionUI(connected) {
        if (connected) {
            this.statusDot.classList.add('connected');
            this.statusText.textContent = 'Connected';
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.sendMessageBtn.disabled = false;
            this.joinChannelBtn.disabled = false;
            this.leaveChannelBtn.disabled = false;

            // Enable action buttons
            document.querySelectorAll('.btn-action').forEach(btn => {
                btn.disabled = false;
            });
        } else {
            this.statusDot.classList.remove('connected');
            this.statusText.textContent = 'Disconnected';
            this.clientIdDisplay.textContent = '';
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
            this.sendMessageBtn.disabled = true;
            this.joinChannelBtn.disabled = true;
            this.leaveChannelBtn.disabled = true;

            // Disable action buttons
            document.querySelectorAll('.btn-action').forEach(btn => {
                btn.disabled = true;
            });
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Initialize demo client when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.demoClient = new WebSocketDemoClient();
    console.log('WebSocket Demo Client initialized');
});
