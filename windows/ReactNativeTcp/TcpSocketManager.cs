using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Threading;

namespace ReactNativeTcp
{
    internal class TcpSocketManager : ITcpSocketManager, IDisposable
    {
        // State object for reading client data asynchronously
        private class StateObject
        {
            // Size of receive buffer.
            public const int BufferSize = 1024;

            public int Id;

            // Receive buffer.
            public byte[] buffer = new byte[BufferSize];

            // Client socket.
            public Socket workSocket = null;
        }

        // Connected Clients.
        private readonly Dictionary<int, Socket> _clients = new Dictionary<int, Socket>();

        private int _instances = 5000;
        private static ManualResetEvent _acceptedConnection = new ManualResetEvent(false);

        private IPEndPoint GetEndpoint(string host, int port)
        {
            var ipHostInfo = Dns.GetHostEntry(host ?? Dns.GetHostName());
            var ipAddress = ipHostInfo.AddressList[0];
            return new IPEndPoint(ipAddress, port);
        }

        public void Listen(int cId, string host, int port)
        {
            var endpoint = GetEndpoint(host, port);

            // Create a TCP/IP socket.
            var listener = new Socket(endpoint.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
            try
            {
                listener.Bind(endpoint);
                listener.Listen(100);
                _clients.Add(cId, listener);

                while (true)
                {
                    // Set the event to nonsignaled state.
                    _acceptedConnection.Reset();

                    // Start an asynchronous socket to listen for connections.
                    listener.AcceptAsync()
                        .ContinueWith(socket => OnAccept(socket.Result, cId));

                    // Wait until a connection is made before continuing.
                    _acceptedConnection.WaitOne();
                }
            }
            catch (Exception e)
            {
                OnError?.Invoke(this, new SocketCloseArgs
                {
                    Id = cId,
                    Error = e.Message,
                });
            }
        }

        public void Connect(int cId, string host, int port)
        {
            var endpoint = GetEndpoint(host, port);

            // Create a TCP/IP socket.
            var socket = new Socket(endpoint.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
            try
            {
                socket.ConnectAsync(endpoint)
                    .ContinueWith(task => OnSocketConnect(socket, cId, endpoint));
            }
            catch (Exception e)
            {
                OnError?.Invoke(this, new SocketCloseArgs
                {
                    Id = cId,
                    Error = e.Message,
                });
            }
        }

        public void Write(int cId, byte[] data)
        {
            if (_clients.TryGetValue(cId, out Socket socket))
            {
                socket.Send(data);
            }
        }

        public void Close(int cId)
        {
            if (_clients.TryGetValue(cId, out Socket socket))
            {
                socket.Close();
            }
            else
            {
                OnError?.Invoke(this, new SocketCloseArgs
                {
                    Id = cId,
                    Error = "Unable to find Socket",
                });
            }
        }

        public void CloseAllSockets()
        {
            foreach (var client in _clients)
            {
                Close(client.Key);
            }
        }

        public void Dispose()
        {
            CloseAllSockets();
        }

        private void OnAccept(Socket handler, int cId)
        {
            // Signal the main thread to continue.
            _acceptedConnection.Set();

            _clients.Add(_instances, handler);
            BeginReceive(handler, cId);

            OnConnection?.Invoke(this, new SocketConnectionArgs
            {
                Id = cId,
                ClientId = _instances,
                ConnectionInfo = (IPEndPoint)handler.RemoteEndPoint,
            });

            _instances++;
        }

        private void OnSocketConnect(Socket handler, int cId, IPEndPoint endpoint)
        {
            _clients.Add(cId, handler);
            BeginReceive(handler, cId);

            OnConnect?.Invoke(this, new SocketConnectArgs
            {
                Id = cId,
                ConnectionInfo = endpoint,
            });
        }

        private void BeginReceive(Socket handler, int cId)
        {
            var state = new StateObject
            {
                Id = cId,
                workSocket = handler,
            };

            handler
              .ReceiveAsync(state.buffer, SocketFlags.None)
              .ContinueWith(task => OnReceive(state, task.Result));
        }

        private void OnReceive(StateObject state, int bytesRead)
        {
            var handler = state.workSocket;

            if (bytesRead > 0)
            {
                var resultBuffer = new byte[bytesRead];
                Array.Copy(state.buffer, 0, resultBuffer, 0, bytesRead);

                OnData?.Invoke(this, new SocketDataArgs
                {
                    Id = state.Id,
                    Data = resultBuffer,
                });

                handler
                  .ReceiveAsync(state.buffer, SocketFlags.None)
                  .ContinueWith(task => OnReceive(state, task.Result));
            }
            else
            {
                OnClose?.Invoke(this, new SocketCloseArgs
                {
                    Id = state.Id,
                });
            }
        }

        public event EventHandler<SocketConnectionArgs> OnConnection;

        public event EventHandler<SocketConnectArgs> OnConnect;

        public event EventHandler<SocketDataArgs> OnData;

        public event EventHandler<SocketCloseArgs> OnClose;

        public event EventHandler<SocketCloseArgs> OnError;
    }
}