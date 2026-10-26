import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // console.log(`Socket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // console.log(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('driver:toggle_online')
  handleDriverToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { driverId: number; online: boolean; name?: string },
  ) {
    this.server.emit('driver:status', data);
    return { success: true };
  }

  emitDriverStatus(driverId: number, online: boolean, name?: string) {
    if (this.server) {
      this.server.emit('driver:status', { driverId, online, name });
    }
  }

  emitOrderStatus(orderId: number, status: string, driverId?: number) {
    if (this.server) {
      this.server.emit('order:status', { orderId, status, driverId });
    }
  }

  emitAnnouncement(target: 'merchants' | 'drivers' | 'both', message: string, title?: string) {
    if (this.server) {
      this.server.emit('broadcast:announcement', {
        target,
        title: title || 'BuckDuck Notice',
        message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
