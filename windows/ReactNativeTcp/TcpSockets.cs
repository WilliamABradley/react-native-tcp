using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Runtime.CompilerServices;
using Microsoft.ReactNative.Managed;
using System.Net.Sockets;

namespace ReactNativeTcp
{
    [ReactModule(MODULE_NAME)]
    internal sealed class TcpSockets : INodeTcpSocket, IDisposable
    {
        private const string MODULE_NAME = "TcpSockets";
        private ReactContext _reactContext;
        private ITcpSocketManager _socketManager;
        private bool _shuttingDown = false;

        [ReactInitializer]
        public void Initialize(ReactContext reactContext)
        {
            _reactContext = reactContext;
            _socketManager = new TcpSocketManager();
            _socketManager.OnConnection += _socketManager_OnConnection;
            _socketManager.OnConnect += _socketManager_OnConnect;
            _socketManager.OnData += _socketManager_OnData;
            _socketManager.OnClose += _socketManager_OnClose;
            _socketManager.OnError += _socketManager_OnError;
        }

        [ReactMethod("listen")]
        public async void Listen(int cId, string host, int port)
        {
            await PerformTask(cId, Task.Run(() =>
            {
                _socketManager.Listen(cId, host, port);
            }));
        }

        [ReactMethod("connect")]
        public async void Connect(int cId, string host, int port, IDictionary<string, object> options = null)
        {
            await PerformTask(cId, Task.Run(() =>
            {
                _socketManager.Connect(cId, host, port);
            }));
        }

        [ReactMethod("write")]
        public async void Write(int cId, string base64String, Action callback)
        {
            await PerformTask(cId, Task.Run(() =>
            {
                _socketManager.Write(cId, Convert.FromBase64String(base64String));
                callback?.Invoke();
            }));
        }

        [ReactMethod("end")]
        public async void End(int cId)
        {
            await PerformTask(cId, Task.Run(() =>
            {
                _socketManager.Close(cId);
            }));
        }

        [ReactMethod("destroy")]
        public void Destroy(int cId)
        {
            End(cId);
        }

        public void Dispose()
        {
            try
            {
                _shuttingDown = true;
                _socketManager.Dispose();
            }
            catch (Exception e)
            {
                Debug.WriteLine($"Exception on Dispose: {e.Message}");
            }
        }

        private void _socketManager_OnConnection(object sender, SocketConnectionArgs e)
        {
            if (_shuttingDown) return;
            SendEvent("connection", new
            {
                id = e.Id,
                info = new
                {
                    id = e.ClientId,
                    address = new
                    {
                        address = e.ConnectionInfo.Address.ToString(),
                        family = e.ConnectionInfo.Address.AddressFamily == AddressFamily.InterNetworkV6 ? "IPv6" : "IPv4",
                        port = e.ConnectionInfo.Port,
                    },
                }
            });
        }

        private void _socketManager_OnConnect(object sender, SocketConnectArgs e)
        {
            if (_shuttingDown) return;
            SendEvent("connect", new
            {
                id = e.Id,
                info = new
                {
                    address = new
                    {
                        address = e.ConnectionInfo.Address.ToString(),
                        family = e.ConnectionInfo.Address.AddressFamily == AddressFamily.InterNetworkV6 ? "IPv6" : "IPv4",
                        port = e.ConnectionInfo.Port,
                    },
                }
            });
        }

        private void _socketManager_OnData(object sender, SocketDataArgs e)
        {
            if (_shuttingDown) return;
            SendEvent("data", new
            {
                id = e.Id,
                data = Convert.ToBase64String(e.Data),
            });
        }

        private void _socketManager_OnError(object sender, SocketCloseArgs e)
        {
            if (_shuttingDown) return;
            HandleError(e.Id, e.Error);
        }

        private void _socketManager_OnClose(object sender, SocketCloseArgs e)
        {
            if (_shuttingDown) return;
            if (e.Error != null) HandleError(e.Id, e.Error);

            SendEvent("close", new
            {
                id = e.Id,
                hadError = e.Error != null,
            });
        }

        private async Task PerformTask(int cId, Task task, [CallerMemberName] string taskName = null)
        {
            if (taskName == null) throw new Exception("Could not determine task name");
            try
            {
                await task;
            }
            catch (Exception e)
            {
                Debug.WriteLine($"TcpSockets {taskName} Exception: {e.Message}");
                HandleError(cId, e.Message);
            }
        }

        private void HandleError(int id, string error)
        {
            if (_shuttingDown) return;
            SendEvent("error", new
            {
                id,
                error,
            });
        }

        private void SendEvent(string eventName, object data)
        {
            _reactContext.EmitJSEvent(MODULE_NAME, eventName, data);
        }
    }
}