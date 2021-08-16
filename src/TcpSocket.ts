/**
 * Copyright (c) 2015-present, Peel Technologies, Inc.
 * All rights reserved.
 */

import 'process';
import 'buffer';

import * as stream from 'stream';
import { AddressInfo, Socket, SocketConnectOpts, SocketConstructorOpts, TcpSocketConnectOpts } from 'net-ish';
import ipRegex from 'ip-regex';
import { EmitterSubscription, NativeEventEmitter, NativeModules } from 'react-native';
import * as base64 from 'base-64';

const Sockets = NativeModules.TcpSockets;
let instances = 0;

enum STATE {
  DISCONNECTED = 0,
  CONNECTING = 1,
  CONNECTED = 2,
};

type SocketAddress = {} | AddressInfo;

export default class TcpSocket extends stream.Duplex implements Socket {
  constructor(options?: SocketConstructorOpts & { id?: number; }) {
    super();

    if (options && options.id) {
      // e.g. incoming server connections
      this.id = Number(options.id);

      if (this.id <= instances) {
        throw new Error('Socket id ' + this.id + 'already in use');
      }
    } else {
      // javascript generated sockets range from 1-1000
      this.id = instances++;
    }

    this._eventEmitter = new NativeEventEmitter(Sockets);
    this.read(0);
  }

  id: number;
  private _eventEmitter: NativeEventEmitter;
  private _state: STATE = STATE.DISCONNECTED;
  private _subs: EmitterSubscription[] = [];
  private _address: SocketAddress = {};
  private _reading: boolean = false;
  private _consuming: boolean = false;
  private _destroyed: boolean = false;
  private _timeout?: {
    handle: number;
    msecs: number;
  };

  connect(options: SocketConnectOpts, connectionListener?: () => void): this;
  connect(port: number, host: string, connectionListener?: () => void): this;
  connect(port: number, connectionListener?: () => void): this;
  connect(path: string, connectionListener?: () => void): this;
  connect(port: any, host?: any, connectionListener?: any): this
  connect(...args: Parameters<TcpSocket['connect']>): this {
    this._registerEvents();

    const [options, callback] = NormalizeConnectArgs(args);

    if (callback) {
      this.once('connect', callback);
    }

    const host = options.host || 'localhost';
    let port = options.port || 0;
    const localAddress = options.localAddress;
    const localPort = options.localPort;

    if (localAddress && !ipRegex({ exact: true }).test(localAddress)) {
      throw new TypeError(
        '"localAddress" option must be a valid IP: ' + localAddress,
      );
    }

    if (localPort && typeof localPort !== 'number') {
      throw new TypeError('"localPort" option should be a number: ' + localPort);
    }

    if (typeof port !== 'undefined') {
      if (typeof port !== 'number' && typeof port !== 'string') {
        throw new TypeError(
          '"port" option should be a number or string: ' + port,
        );
      }

      port = +port;

      if (!isLegalPort(port)) {
        throw new RangeError('"port" option should be >= 0 and < 65536: ' + port);
      }
    }

    const timeout = (<any>options).timeout;
    if (timeout) {
      this.setTimeout(timeout);
    } else if (this._timeout) {
      this._activeTimer(this._timeout.msecs);
    }

    this._state = STATE.CONNECTING;
    this._debug('connecting, host:', host, 'port:', port);

    this._destroyed = false;
    Sockets.connect(this.id, host, Number(port), options);

    return this;
  }

  // Extended base method
  write: Socket['write'] = (...args) => {
    const chunk = args[0];
    if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) {
      throw new TypeError(
        'Invalid data, chunk must be a string or buffer, not ' + typeof chunk,
      );
    }

    // @ts-ignore
    return super.write(...args);
  }

  // Extended base methods
  read: Socket['read'] = (n) => {
    if (n === 0) {
      return super.read(n);
    }

    this.read = super.read;
    this._consuming = true;
    return this.read(n);
  }

  setTimeout(timeout: number, callback?: () => void): this {
    if (timeout === 0) {
      this._clearTimeout();
      if (callback) {
        this.removeListener('timeout', callback);
      }
    } else {
      if (callback) {
        this.once('timeout', callback);
      }

      this._activeTimer(timeout);
    }

    return this;
  }

  // No impl
  setNoDelay(noDelay?: boolean): this {
    return this;
  }

  // No impl
  setKeepAlive(enable?: boolean, initialDelay?: number): this {
    return this;
  }

  address(): {} | AddressInfo {
    return this._address;
  }

  // No impl
  unref(): this {
    return this;
  }

  // No impl
  ref(): this {
    return this;
  }

  end: Socket['end'] = (...args) => {
    const [data, encoding] = args;
    // @ts-ignore
    super.end(data, encoding);

    if (this._destroyed) {
      return;
    }

    if (data) {
      // @ts-ignore
      this.write(data, encoding);
    }

    if (this.readable) {
      this.read(0);
      this.readable = false;
    }

    this._destroyed = true;
    this._debug('ending');

    Sockets.end(this.id);
  };

  destroy() {
    if (!this._destroyed) {
      this._destroyed = true;
      this._debug('destroying');
      this._clearTimeout();

      Sockets.destroy(this.id);
    }
  };

  _write(buffer: any, encoding?: string, callback?: (err?: Error) => void): boolean {
    if (this._state === STATE.DISCONNECTED) {
      throw new Error('Socket is not connected.');
    } else if (this._state === STATE.CONNECTING) {
      // we're ok, GCDAsyncSocket handles queueing internally
    }

    let str;
    if (typeof buffer === 'string') {
      this._debug('socket.WRITE(): encoding as base64');
      str = base64.encode(buffer);
    } else if (Buffer.isBuffer(buffer)) {
      str = buffer.toString('base64');
    } else {
      throw new TypeError(
        'Invalid data, chunk must be a string or buffer, not ' + typeof buffer,
      );
    }

    Sockets.write(this.id, str, (err: any) => {
      if (this._timeout) {
        this._activeTimer(this._timeout.msecs);
      }

      err = this._normalizeError(err);
      if (err) {
        this._debug('write failed', err);
        return callback?.(err);
      }

      callback?.();
    });

    return true;
  }

  _read(n: number) {
    this._debug('_read');

    if (this._state === STATE.CONNECTING) {
      this._debug('_read wait for connection');
      this.once('connect', () => this._read(n));
    } else if (!this._reading) {
      // not already reading, start the flow
      this._debug('Socket._read resume');
      this._reading = true;
      this.resume();
    }
  }

  _registerEvents() {
    if (this._subs && this._subs.length > 0) {
      return;
    }

    this._subs = [
      this._eventEmitter.addListener('connect', ev => {
        if (this.id !== ev.id) {
          return;
        }
        this._onConnect(ev.address);
      }),
      this._eventEmitter.addListener('connection', ev => {
        if (this.id !== ev.id) {
          return;
        }
        this._onConnection(ev.info);
      }),
      this._eventEmitter.addListener('data', ev => {
        if (this.id !== ev.id) {
          return;
        }
        this._onData(ev.data);
      }),
      this._eventEmitter.addListener('close', ev => {
        if (this.id !== ev.id) {
          return;
        }
        this._onClose(ev.hadError);
      }),
      this._eventEmitter.addListener('error', ev => {
        if (this.id !== ev.id) {
          return;
        }
        this._onError(ev.error);
      }),
    ];
  }

  _unregisterEvents() {
    this._subs.forEach(e => e.remove());
    this._subs = [];
  }

  private _debug(...args: Parameters<Console['log']>) {
    if (__DEV__) {
      args.unshift('socket-' + this.id);
      console.log.apply(console, args);
    }
  }

  private _normalizeError(err: Error | string): Error | undefined {
    if (err) {
      if (typeof err === 'string') {
        err = new Error(err);
      }

      return err;
    }
    return undefined;
  }

  private _activeTimer(timeout: number) {
    if (this._timeout && this._timeout.handle) {
      clearTimeout(this._timeout.handle);
    }

    this._timeout = {
      handle: <number><unknown>setTimeout(() => {
        this._timeout = undefined;
        this.emit('timeout');
      }, timeout),
      msecs: timeout,
    };
  }

  private _clearTimeout() {
    if (this._timeout) {
      clearTimeout(this._timeout.handle);
      this._timeout = undefined;
    }
  }

  private _onConnect(address: SocketAddress) {
    this._debug('received', 'connect');

    this._setConnected(address);
    this.emit('connect');

    this.read(0);
  }

  private _onConnection(info: { id: number, address: SocketAddress }): void {
    this._debug('received', 'connection');

    const socket = new TcpSocket({ id: info.id });
    socket._registerEvents();
    socket._setConnected(info.address);

    this.emit('connection', socket);
  }

  private _onData(data: string): void {
    this._debug('received', 'data');

    if (this._timeout) {
      this._activeTimer(this._timeout.msecs);
    }

    if (data && data.length > 0) {
      // debug('got data');

      // read success.
      // In theory (and in practice) calling readStop right now
      // will prevent this from being called again until _read() gets
      // called again.

      var ret = this.push(new Buffer(data, 'base64'));
      if (this._reading && !ret) {
        this._reading = false;
        this.pause();
      }

      return;
    }
  }

  private _onClose(hadError: boolean): void {
    this._debug('received', 'close');
    this._setDisconnected(hadError);
  }

  private _onError(error: string): void {
    this._debug('received', 'error');
    this.emit('error', this._normalizeError(error));
    this.destroy();
  }

  private _setConnected(address: SocketAddress) {
    this._state = STATE.CONNECTED;
    this._address = address;
  }

  private _setDisconnected(hadError: boolean): void {
    if (this._state === STATE.DISCONNECTED) {
      return;
    }

    this._unregisterEvents();
    this._state = STATE.DISCONNECTED;
    this.emit('close', hadError);
  }

  bufferSize: number = 1024;
  bytesRead: number = 0;
  bytesWritten: number = 0;
  connecting: boolean = false;
  localAddress: string = '0.0.0.0';
  localPort: number = 0;
  remoteAddress?: string | undefined;
  remoteFamily?: string | undefined;
  remotePort?: number | undefined;
}

// Returns an array [options] or [options, cb]
// It is the same as the argument of TcpSocket#connect
export function NormalizeConnectArgs(args: Parameters<TcpSocket['connect']>): [TcpSocketConnectOpts] | [TcpSocketConnectOpts, () => void] {
  let options: TcpSocketConnectOpts = {
    port: 0,
  };

  if (args[0] !== null && typeof args[0] === 'object') {
    // connect(options, [cb])
    options = args[0];
  } else {
    // connect(port, [host], [cb])
    options.port = args[0];
    if (typeof args[1] === 'string') {
      options.host = args[1];
    }
  }

  const cb = args[args.length - 1];
  return typeof cb === 'function' ? [options, cb] : [options];
}

// Check that the port number is not NaN when coerced to a number,
// is an integer and that it falls within the legal range of port numbers.
function isLegalPort(port: number | string): boolean {
  if (typeof port === 'string') {
    if (port.trim() === '') {
      return false;
    } else {
      port = parseInt(port, 10);
    }
  }
  return +port === port >>> 0 && port >= 0 && port <= 0xffff;
}
