import { Injectable } from '@nestjs/common';
import { EventRegistry } from './event-registry.service';

@Injectable()
export class EventDispatcher {
  constructor(private registry: EventRegistry) {}

  async dispatch(topic: string, data: any) {
    const handler = this.registry.get(topic);

    if (!handler) {
      console.warn(`No handler para ${topic}`);

      return;
    }

    await handler.handle(data);
  }
}
