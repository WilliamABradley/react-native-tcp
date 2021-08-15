using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Microsoft.ReactNative;
using Microsoft.ReactNative.Managed;

namespace ReactNativeTcp
{
  [ReactModule("ReactNativeTcp")]
  internal sealed class ReactNativeModule
  {
    private ReactContext _reactContext;

    [ReactInitializer]
    public void Initialize(ReactContext reactContext)
    {
      _reactContext = reactContext;
    }

    [ReactMethod]
    public void sampleMethod(string stringArgument, int numberArgument, Action<string> callback)
    {
      // TODO: Implement some actually useful functionality
      callback("Received numberArgument: " + numberArgument + " stringArgument: " + stringArgument);
    }
  }
}
