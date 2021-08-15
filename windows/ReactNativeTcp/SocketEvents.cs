using System;
using System.Net;

namespace ReactNativeTcp
{
    internal abstract class SocketEventArgs : EventArgs
    {
        public int Id { get; set; }
    }

    internal class SocketConnectArgs : SocketEventArgs
    {
        public IPEndPoint ConnectionInfo { get; set; }
    }

    internal class SocketConnectionArgs : SocketConnectArgs
    {
        public int ClientId { get; set; }
    }

    internal class SocketDataArgs : SocketEventArgs
    {
        public byte[] Data { get; set; }
    }

    internal class SocketCloseArgs : SocketEventArgs
    {
        public string Error { get; set; }
    }
}