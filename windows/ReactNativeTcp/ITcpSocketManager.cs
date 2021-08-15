using System;

namespace ReactNativeTcp
{
    internal interface ITcpSocketManager : IDisposable
    {
        void Listen(int cId, string host, int port);

        void Connect(int cId, string host, int port);

        void Write(int cId, byte[] data);

        void Close(int cId);

        void CloseAllSockets();

        event EventHandler<SocketConnectionArgs> OnConnection;

        event EventHandler<SocketConnectArgs> OnConnect;

        event EventHandler<SocketDataArgs> OnData;

        event EventHandler<SocketCloseArgs> OnClose;

        event EventHandler<SocketCloseArgs> OnError;
    }
}