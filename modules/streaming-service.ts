import { NativeModules, Platform } from "react-native";

const { StreamingModule } = NativeModules as {
  StreamingModule?: {
    startStreaming(roomId: string, serverUrl: string): void;
    stopStreaming(): void;
    setAutoStart(enabled: boolean): void;
    getAutoStart(): Promise<boolean>;
  };
};

export const isNativeStreamingAvailable =
  Platform.OS === "android" && !!StreamingModule;

export const NativeStreaming = {
  start(roomId: string, serverUrl: string): void {
    if (!StreamingModule) throw new Error("Native streaming not available");
    StreamingModule.startStreaming(roomId, serverUrl);
  },

  stop(): void {
    StreamingModule?.stopStreaming();
  },

  setAutoStart(enabled: boolean): void {
    StreamingModule?.setAutoStart(enabled);
  },

  async getAutoStart(): Promise<boolean> {
    if (!StreamingModule) return false;
    return StreamingModule.getAutoStart();
  },
};
