export interface EventHandler {
  topic: string;

  handle(data: any): Promise<void>;
}
