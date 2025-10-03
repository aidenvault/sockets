class WebSocketClient {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.connected = false;
        this.auth = null;
        this.initializeUI();
    }

    initializeUI() {
        // Connection controls
        this.serverUrlInput = document.getElementById('serverUrl');
        this.authTypeSelect = document.getElementById('authType');
        this.authValueInput = document.getElementById('authValue');
        this.authValueGroup = document.getElementById('authValueGroup');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');

        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.clientIdDisplay = document.getElementById('clientIdDisplay');

        // Action buttons
        this.pingBtn = document.getElementById('pingBtn');
        this.statusBtn = document.getElementById('statusBtn');
        this.listClientsBtn = document.getElementById('listClientsBtn');
        this.broadcastBtn = document.getElementById('broadcastBtn');
        this.inferenceBtn = document.getElementById('inferenceBtn');
        this.subscribeBtn = document.getElementById('subscribeBtn');
        this.unsubscribeBtn = document.getElementById('unsubscribeBtn');
        this.directMessageBtn = document.getElementById('directMessageBtn');

        // Log
        this.logContainer = document.getElementById('logContainer');
        this.clearLogBtn = document.getElementById('clearLogBtn');

        // Event listeners
        this.authTypeSelect.addEventListener('change', () => this.handleAuthTypeChange());
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.pingBtn.addEventListener('click', () => this.sendPing());
        this.statusBtn.addEventListener('click', () => this.getStatus());
        this.listClientsBtn.addEventListener('click', () => this.listClients());
        this.broadcastBtn.addEventListener('click', () => this.broadcast());
        this.inferenceBtn.addEventListener('click', () => this.inference());
        this.subscribeBtn.addEventListener('click', () => this.subscribe());
        this.unsubscribeBtn.addEventListener('click', () => this.unsubscribe());
        this.directMessageBtn.addEventListener('click', () => this.sendDirectMessage());
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
    }

    handleAuthTypeChange() {
        const authType = this.authTypeSelect.value;
        if (authType === 'none') {
            this.authValueGroup.style.display = 'none';
            this.auth = null;
        } else {
            this.authValueGroup.style.display = 'block';
        }
    }

    connect() {
        const url = this.serverUrlInput.value;
        
        if (this.connected) {
            this.log('Already connected', 'system');
            return;
        }

        this.log(`Connecting to ${url}...`, 'system');

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.connected = true;
                this.updateConnectionStatus(true);
                this.log('Connected to server', 'system');
                this.enableButtons(true);
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                this.log(`WebSocket error: ${error.message || 'Unknown error'}`, 'error');
            };

            this.ws.onclose = (event) => {
                this.connected = false;
                this.updateConnectionStatus(false);
                this.log(`Disconnected from server (code: ${event.code})`, 'system');
                this.enableButtons(false);
            };
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            this.log(`Received: ${JSON.stringify(message, null, 2)}`, 'received');

            // Handle special message types
            if (message.type === 'CONNECTED') {
                this.clientId = message.payload.clientId;
                this.clientIdDisplay.textContent = `Client ID: ${this.clientId}`;
                
                // Send authentication if configured
                this.sendAuthentication();
            } else if (message.type === 'PONG') {
                this.log('Pong received', 'system');
            } else if (message.type === 'ERROR') {
                this.log(`Error: ${message.error.message}`, 'error');
            }
        } catch (error) {
            this.log(`Failed to parse message: ${error.message}`, 'error');
        }
    }

    sendAuthentication() {
        const authType = this.authTypeSelect.value;
        
        if (authType === 'none') {
            return;
        }

        const authValue = this.authValueInput.value.trim();
        
        if (!authValue) {
            this.log('No authentication value provided', 'system');
            return;
        }

        if (authType === 'apiKey') {
            this.auth = { apiKey: authValue };
        } else if (authType === 'jwt') {
            this.auth = { token: authValue };
        }

        // Send a test message with auth to trigger authentication
        this.send({
            type: 'PING',
            auth: this.auth
        });
    }

    send(message) {
        if (!this.connected || !this.ws) {
            this.log('Not connected', 'error');
            return;
        }

        // Add auth to every message if available
        if (this.auth && !message.auth) {
            message.auth = this.auth;
        }

        const jsonMessage = JSON.stringify(message);
        this.ws.send(jsonMessage);
        this.log(`Sent: ${JSON.stringify(message, null, 2)}`, 'sent');
    }

    sendPing() {
        this.send({ type: 'PING' });
    }

    getStatus() {
        this.send({ type: 'GET_STATUS' });
    }

    listClients() {
        this.send({ type: 'LIST_CLIENTS' });
    }

    broadcast() {
        const channel = document.getElementById('broadcastChannel').value.trim() || 'default';
        const message = document.getElementById('broadcastMessage').value.trim();

        if (!message) {
            this.log('Broadcast message cannot be empty', 'error');
            return;
        }

        this.send({
            type: 'BROADCAST',
            payload: {
                channel,
                message
            }
        });

        document.getElementById('broadcastMessage').value = '';
    }

    inference() {
        const input = document.getElementById('inferenceInput').value.trim();

        if (!input) {
            this.log('Inference input cannot be empty', 'error');
            return;
        }

        this.send({
            type: 'INFERENCE_REQUEST',
            payload: {
                input,
                requestId: `req_${Date.now()}`
            }
        });

        document.getElementById('inferenceInput').value = '';
    }

    subscribe() {
        const channel = document.getElementById('subscribeChannel').value.trim() || 'default';

        this.send({
            type: 'SUBSCRIBE',
            payload: {
                channel
            }
        });
    }

    unsubscribe() {
        const channel = document.getElementById('subscribeChannel').value.trim() || 'default';

        this.send({
            type: 'UNSUBSCRIBE',
            payload: {
                channel
            }
        });
    }

    sendDirectMessage() {
        const targetClientId = document.getElementById('targetClientId').value.trim();
        const message = document.getElementById('directMessage').value.trim();

        if (!targetClientId) {
            this.log('Target client ID cannot be empty', 'error');
            return;
        }

        if (!message) {
            this.log('Direct message cannot be empty', 'error');
            return;
        }

        this.send({
            type: 'DIRECT_MESSAGE',
            payload: {
                targetClientId,
                message
            }
        });

        document.getElementById('directMessage').value = '';
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.statusIndicator.classList.add('connected');
            this.statusText.textContent = 'Connected';
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
        } else {
            this.statusIndicator.classList.remove('connected');
            this.statusText.textContent = 'Disconnected';
            this.clientIdDisplay.textContent = 'Client ID: Not connected';
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
            this.clientId = null;
        }
    }

    enableButtons(enabled) {
        this.pingBtn.disabled = !enabled;
        this.statusBtn.disabled = !enabled;
        this.listClientsBtn.disabled = !enabled;
        this.broadcastBtn.disabled = !enabled;
        this.inferenceBtn.disabled = !enabled;
        this.subscribeBtn.disabled = !enabled;
        this.unsubscribeBtn.disabled = !enabled;
        this.directMessageBtn.disabled = !enabled;
    }

    log(message, type = 'system') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;

        const timestamp = new Date().toLocaleTimeString();
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        entry.innerHTML = `
            <div>
                <span class="log-timestamp">[${timestamp}]</span>
                <span class="log-type ${type}">${typeLabel}</span>
            </div>
            <div class="log-content">${this.escapeHtml(message)}</div>
        `;

        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    clearLog() {
        this.logContainer.innerHTML = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the client
const client = new WebSocketClient();
