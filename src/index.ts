import Socket from './TcpSocket';
import Server from './TcpServer';

export { default as Socket } from './TcpSocket';
export { default as Server } from './TcpServer';
export * from './utils';

export function createServer(connectionListener: (socket: Socket) => void): Server {
  return new Server(connectionListener);
};

export function createConnection(...args: Parameters<Socket['connect']>): Socket {
  const tcpSocket = new Socket();
  return tcpSocket.connect(...args);
}

export const connect = createConnection;
