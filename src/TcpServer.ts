import { EventEmitter } from 'events';
import { AddressInfo, ListenOptions, Server, ServerOpts } from 'net-ish';
import { NativeModules } from 'react-native';
import Socket, { NormalizeConnectArgs } from './TcpSocket';

const Sockets = NativeModules.TcpSockets;

export default class TcpServer extends EventEmitter implements Server {
  constructor(...args: [(socket: Socket) => void] | [ServerOpts, (socket: Socket) => void]) {
    super();
    this._socket = new Socket();

    this._socket.on('connect', () => {
      this.emit('listening');
    });
    this._socket.on('connection', (socket) => {
      this.connections++;
      this.emit('connection', socket);
    });
    this._socket.on('error', (error) => {
      this.emit('error', error);
    });

    const callback = args.length === 2
      ? args[1]
      : args[0];

    if (typeof callback === 'function') {
      this.on('connection', callback);
    }
  }

  private _socket: Socket;

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
    const [options, callback] = NormalizeConnectArgs(<any>arguments);

    if (callback) {
      this.once('listening', callback);
    }

    this._socket._registerEvents();
    Sockets.listen(this._socket.id, options.host || '0.0.0.0', options.port);
    this.listening = true;

    return this;
  }

  close(callback?: (err?: Error) => void): this {
    if (typeof callback === 'function') {
      if (!this._socket) {
        this.once('close', function close() {
          callback(new Error('Not running'));
        });
      } else {
        this.once('close', callback);
      }
    }

    if (this._socket) {
      this._socket.end();
    }

    setImmediate(() => {
      this.emit('close');
      this.listening = false;
    });

    return this;
  }

  address(): string | AddressInfo | null {
    if (this._socket) {
      const socketAddress = this._socket.address();
      if (Object.keys(socketAddress).length > 0) {
        return <AddressInfo>socketAddress;
      }
    }
    return null;
  }

  getConnections(cb: (error: Error | null, count: number) => void): void {
    if (typeof cb === 'function') {
      cb(null, this.connections);
    }
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }

  maxConnections: number = Infinity;
  connections: number = 0;
  listening: boolean = false;
}
