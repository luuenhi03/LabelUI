import { useEffect } from "react";
import WebSocketClient from "../utils/WebSocketClient";

const useWebSocket = () => {
  useEffect(() => {
    // Connect to WebSocket when component mounts
    WebSocketClient.connect();

    // Cleanup: disconnect when component unmounts
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
