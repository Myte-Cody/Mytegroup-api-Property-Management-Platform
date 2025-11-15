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
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSocketMap = new Map<string, Set<string>>(); // userId -> Set of socketIds

  afterInit() {
    this.logger.log('Notifications Gateway initialized');
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

    this.logger.log(`Client ${client.id} connected for user ${userId}`);
    this.logger.debug(
      `Active connections for user ${userId}: ${this.userSocketMap.get(userId as string)?.size}`,
    );
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

    this.logger.log(`Client ${client.id} disconnected`);
  }

  // Emit notification to specific user
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
    this.logger.debug(`Emitted '${event}' to user ${userId}`);
  }

  // Emit notification to multiple users
  emitToUsers(userIds: string[], event: string, data: any) {
    userIds.forEach((userId) => {
      this.emitToUser(userId, event, data);
    });
  }

  // Broadcast to all connected clients
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`Broadcast '${event}' to all clients`);
  }

  // Get active connections count for a user
  getUserConnectionCount(userId: string): number {
    return this.userSocketMap.get(userId)?.size || 0;
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.userSocketMap.has(userId) && this.userSocketMap.get(userId)!.size > 0;
  }
}
