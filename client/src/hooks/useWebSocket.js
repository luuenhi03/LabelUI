import { useEffect } from "react";
import WebSocketClient from "../utils/WebSocketClient";

const useWebSocket = () => {
  useEffect(() => {
    WebSocketClient.connect();

    return () => {
      WebSocketClient.disconnect();
    };
  }, []);

  return {
    send: WebSocketClient.send.bind(WebSocketClient),
    isConnected: () => WebSocketClient.ws?.readyState === 1, // WebSocket.OPEN = 1
  };
};

export default useWebSocket;
