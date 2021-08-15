using System;
using System.Collections.Generic;

namespace ReactNativeTcp
{
    internal interface INodeTcpSocket
    {
        void Listen(int cId, string host, int port);

        void Connect(int cId, string host, int port, IDictionary<string, object> options = null);

        void Write(int cId, string base64String, Action callback);

        void End(int cId);

        void Destroy(int cId);
    }
}