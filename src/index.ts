/**
 * Copyright (c) 2015-present, Peel Technologies, Inc.
 * All rights reserved.
 */

import ipRegex from 'ip-regex';
import Socket from './TcpSocket';
import Server from './TcpServer';

export { default as Socket } from './TcpSocket';
export { default as Server } from './TcpServer';

export function createServer(connectionListener: (socket: Socket) => void): Server {
  return new Server(connectionListener);
};

export function createConnection(...args: Parameters<Socket['connect']>): Socket {
  const tcpSocket = new Socket();
  return tcpSocket.connect(...args);
}

export const connect = createConnection;

export function isIP(input: string): number {
  var result = 0;
  if (ipRegex.v4({ exact: true }).test(input)) {
    result = 4;
  } else if (ipRegex.v6({ exact: true }).test(input)) {
    result = 6;
  }
  return result;
};

export function isIPv4(input: string): boolean {
  return isIP(input) === 4;
};

export function isIPv6(input: string): boolean {
  return isIP(input) === 6;
};
