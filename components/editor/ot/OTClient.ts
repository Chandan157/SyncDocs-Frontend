export type OpType = 'insert' | 'delete' | 'replace';

export interface Operation {
  type: OpType;
  position: number;
  text?: string;
  length?: number;
}

export interface ClientOperation {
  revision: number;
  operation: Operation;
  clientId: string;
}

export class OTClient {
  public revision: number = 0;
  public documentId: string;
  public clientId: string;
  private ws!: WebSocket;
  private pendingOperations: ClientOperation[] = [];
  
  // Callbacks for Tiptap
  public onIncomingOperation?: (op: Operation) => void;
  public onDocumentLoaded?: (content: string, role?: string) => void;
  public onUserJoined?: (userId: string) => void;
  public onUserLeft?: (userId: string) => void;

  private wsUrl: string;
  private token: string;
  public isReconnecting: boolean = false;

  constructor(wsUrl: string, documentId: string, token: string) {
    this.wsUrl = wsUrl;
    this.token = token;
    this.documentId = documentId;
    this.clientId = crypto.randomUUID();
    
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(`${this.wsUrl}?token=${this.token}`);
    
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'join-document', documentId: this.documentId }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      // Basic reconnection
      this.isReconnecting = true;
      setTimeout(() => this.connect(), 3000);
    };
  }

  public onError?: (msg: string) => void;

  public onReconnectDocumentLoaded?: (content: string, role?: string) => void;

  private handleMessage(data: any) {
    switch (data.type) {
      case 'error':
        if (this.onError) this.onError(data.message);
        console.error('OTClient Error:', data.message);
        break;
      case 'document-loaded':
        this.revision = data.revision;
        if (this.isReconnecting && this.onReconnectDocumentLoaded) {
          this.onReconnectDocumentLoaded(data.content, data.role);
        } else if (this.onDocumentLoaded) {
          this.onDocumentLoaded(data.content, data.role);
        }
        this.isReconnecting = false;
        break;
      case 'operation-applied':
        if (data.clientId === this.clientId) {
          // ACK: Remove from pending
          this.pendingOperations.shift();
          this.revision = data.revision;
          
          // Send next pending if any
          if (this.pendingOperations.length > 0) {
            this.sendOperation(this.pendingOperations[0].operation);
          }
        } else {
          // Incoming operation from someone else
          let incomingOp = data.operation as Operation;
          
          // Transform against our pending operations
          for (const pending of this.pendingOperations) {
            incomingOp = this.transform(incomingOp, pending.operation);
          }
          
          this.revision = data.revision;
          if (this.onIncomingOperation) this.onIncomingOperation(incomingOp);
        }
        break;
      case 'user-joined':
        if (this.onUserJoined) this.onUserJoined(data.userId);
        break;
      case 'user-left':
        if (this.onUserLeft) this.onUserLeft(data.userId);
        break;
    }
  }

  public applyLocalOperation(op: Operation) {
    const clientOp: ClientOperation = {
      revision: this.revision,
      operation: op,
      clientId: this.clientId
    };
    
    this.pendingOperations.push(clientOp);
    
    // If it's the only one in the queue, send immediately. 
    // Otherwise it waits for the previous ACK.
    if (this.pendingOperations.length === 1) {
      this.sendOperation(op);
    }
  }

  private sendOperation(op: Operation) {
    this.ws.send(JSON.stringify({
      type: 'operation',
      revision: this.revision,
      operation: op,
      clientId: this.clientId
    }));
  }

  public destroy() {
    this.ws.close();
  }

  // Client-side transformation is symmetrical to server
  private transform(op1: Operation, op2: Operation): Operation {
    let transformed: Operation = { ...op1 };
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position >= op2.position) transformed.position += (op2.text?.length || 0);
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position > op2.position) transformed.position = Math.max(op2.position, op1.position - (op2.length || 0));
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position >= op2.position) transformed.position += (op2.text?.length || 0);
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position >= op2.position) {
        transformed.position = Math.max(op2.position, op1.position - (op2.length || 0));
      }
    }
    return transformed;
  }
}
