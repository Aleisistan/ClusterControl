import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const apiUrl = process.env.API_URL?.trim() || 'http://localhost:3000';
const socketUrl = process.env.SOCKET_URL?.trim() || apiUrl;
const configPath = fileURLToPath(
  new URL('../public/runtime-config.json', import.meta.url),
);

await writeFile(
  configPath,
  `${JSON.stringify({ apiUrl, socketUrl })}\n`,
  'utf8',
);
