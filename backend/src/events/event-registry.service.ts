import { Injectable } from '@nestjs/common';
import { EventHandler } from './event-handler.interface';

@Injectable()
export class EventRegistry {
  private handlers = new Map<string, EventHandler>();

  register(handler: EventHandler) {
    this.handlers.set(handler.topic, handler);
  }

  get(topic: string) {
    return this.handlers.get(topic);
  }
}
