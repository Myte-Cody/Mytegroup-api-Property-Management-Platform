import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSocketMap = new Map<string, Set<string>>(); // userId -> Set of socketIds

  afterInit() {
    this.logger.log('Chat Gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;

    if (!userId) {
      this.logger.warn(`Client ${client.id} attempted to connect without userId`);
      client.disconnect();
      return;
    }

    // Store the socket connection for this user
    if (!this.userSocketMap.has(userId as string)) {
      this.userSocketMap.set(userId as string, new Set());
    }
    this.userSocketMap.get(userId as string)?.add(client.id);

    // Join a room specific to this user
    client.join(`user:${userId}`);

    this.logger.log(`Client ${client.id} connected to chat for user ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;

    if (userId) {
      const userSockets = this.userSocketMap.get(userId as string);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSocketMap.delete(userId as string);
        }
      }
    }

    this.logger.log(`Client ${client.id} disconnected from chat`);
  }

  // Emit message to specific thread participants
  emitMessageToThread(userIds: string[], threadId: string, message: any) {
    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('chat:message', {
        threadId,
        message,
      });
    });
    this.logger.debug(`Emitted message to thread ${threadId}`);
  }

  // Emit typing indicator
  emitTypingIndicator(userIds: string[], threadId: string, userId: string, isTyping: boolean) {
    userIds.forEach((recipientId) => {
      if (recipientId !== userId) {
        this.server.to(`user:${recipientId}`).emit('chat:typing', {
          threadId,
          userId,
          isTyping,
        });
      }
    });
  }

  // Emit message read status
  emitMessageRead(userIds: string[], threadId: string, userId: string) {
    userIds.forEach((recipientId) => {
      this.server.to(`user:${recipientId}`).emit('chat:read', {
        threadId,
        userId,
      });
    });
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.userSocketMap.has(userId) && this.userSocketMap.get(userId)!.size > 0;
  }
}
