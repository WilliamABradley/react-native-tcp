/**
 * Copyright (c) 2015-present, Peel Technologies, Inc.
 * All rights reserved.
 */

import { EventEmitter } from 'events';
import { AddressInfo, ListenOptions, Server, ServerOpts } from 'net';
import { NativeModules } from 'react-native';
import Socket from './TcpSocket';

const Sockets = NativeModules.TcpSockets;

export default class TcpServer extends EventEmitter implements Server {
  constructor(connectionListener?: (socket: Socket) => void);
  constructor(options?: ServerOpts, connectionListener?: (socket: Socket) => void) {
    super();
  }

  listen(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): this;
  listen(port?: number, hostname?: string, listeningListener?: () => void): this;
  listen(port?: number, backlog?: number, listeningListener?: () => void): this;
  listen(port?: number, listeningListener?: () => void): this;
  listen(path: string, backlog?: number, listeningListener?: () => void): this;
  listen(path: string, listeningListener?: () => void): this;
  listen(options: ListenOptions, listeningListener?: () => void): this;
  listen(handle: any, backlog?: number, listeningListener?: () => void): this;
  listen(handle: any, listeningListener?: () => void): this;
  listen(port?: any, hostname?: any, backlog?: any, listeningListener?: any): this {
    console.log(listeningListener);
    throw new Error('Method not implemented.');
  }

  close(callback?: (err?: Error) => void): this {
    throw new Error('Method not implemented.');
  }

  address(): string | AddressInfo | null {
    throw new Error('Method not implemented.');
  }

  getConnections(cb: (error: Error | null, count: number) => void): void {
    throw new Error('Method not implemented.');
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }

  maxConnections: number = 0;
  connections: number = 0;
  listening: boolean = false;
}
