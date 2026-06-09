import { CameraView, useCameraPermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { io, type Socket } from "socket.io-client";
import { useColors } from "@/hooks/useColors";
import {
  isNativeStreamingAvailable,
  NativeStreaming,
} from "@/modules/streaming-service";

const ROOM_KEY = "@remotecam/room_id";

function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function getOrCreateRoomId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(ROOM_KEY);
    if (saved) return saved;
    const newId = generateRoomId();
    await AsyncStorage.setItem(ROOM_KEY, newId);
    return newId;
  } catch {
    return generateRoomId();
  }
}

export default function CameraScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [roomId, setRoomId] = useState<string>("");
  const [appInBackground, setAppInBackground] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const socketRef = useRef<Socket | null>(null);
  const isStreamingRef = useRef(false);
  const capturingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost";
  const serverUrl = `https://${domain}`;
  const viewUrl = roomId ? `${serverUrl}/api/view/${roomId}` : "";

  useEffect(() => {
    getOrCreateRoomId().then(setRoomId);
    if (isNativeStreamingAvailable) {
      NativeStreaming.getAutoStart().then(setAutoStart);
    }
  }, []);

  useEffect(() => {
    if (!roomId || isNativeStreamingAvailable) return;

    const socket = io(serverUrl, {
      path: "/api/socket.io/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("camera-join", { roomId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("viewer-join", () => setViewerCount((c) => c + 1));

    return () => {
      isStreamingRef.current = false;
      socket.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    if (isNativeStreamingAvailable) return;

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (prev === "active" && (next === "background" || next === "inactive")) {
        setAppInBackground(true);
        if (isStreamingRef.current) {
          isStreamingRef.current = false;
          capturingRef.current = false;
          setIsStreaming(false);
          deactivateKeepAwake();
        }
      }
      if (next === "active" && prev !== "active") setAppInBackground(false);
    });
    return () => sub.remove();
  }, []);

  const captureLoop = useCallback(async () => {
    if (!isStreamingRef.current || capturingRef.current) return;
    if (!cameraRef.current || !socketRef.current?.connected) {
      if (isStreamingRef.current) setTimeout(captureLoop, 200);
      return;
    }
    capturingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.25,
        shutterSound: false,
        skipProcessing: true,
      } as Parameters<CameraView["takePictureAsync"]>[0]);

      if (photo?.base64 && isStreamingRef.current && socketRef.current?.connected) {
        socketRef.current.emit("frame", { roomId, frame: photo.base64 });
        setFrameCount((c) => c + 1);
      }
    } catch {
    } finally {
      capturingRef.current = false;
    }
    if (isStreamingRef.current) setTimeout(captureLoop, 120);
  }, [roomId]);

  const startStreaming = useCallback(() => {
    if (isNativeStreamingAvailable) {
      NativeStreaming.start(roomId, serverUrl);
      setIsStreaming(true);
      setFrameCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      isStreamingRef.current = true;
      setIsStreaming(true);
      setFrameCount(0);
      activateKeepAwakeAsync();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      captureLoop();
    }
  }, [roomId, serverUrl, captureLoop]);

  const stopStreaming = useCallback(() => {
    if (isNativeStreamingAvailable) {
      NativeStreaming.stop();
    } else {
      isStreamingRef.current = false;
      capturingRef.current = false;
      deactivateKeepAwake();
    }
    setIsStreaming(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const toggleAutoStart = useCallback((val: boolean) => {
    setAutoStart(val);
    NativeStreaming.setAutoStart(val);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const copyCode = useCallback(async () => {
    if (!roomId) return;
    await Clipboard.setStringAsync(roomId);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  const copyLink = useCallback(async () => {
    if (!viewUrl) return;
    await Clipboard.setStringAsync(viewUrl);
    Alert.alert("Link Copied", "Share this link to watch the live stream in any browser.");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [viewUrl]);

  if (!roomId) return <View style={[styles.center, { backgroundColor: "#000" }]} />;

  if (!permission) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><StatusBar style="light" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <StatusBar style="light" />
        <Feather name="camera-off" size={48} color={colors.mutedForeground} />
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera Access Needed</Text>
        <Text style={[styles.permSub, { color: colors.mutedForeground }]}>
          RemoteCam needs camera access to stream video
        </Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={[styles.back, { color: colors.mutedForeground }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar style="light" />

      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {!isStreaming && <View style={[StyleSheet.absoluteFill, styles.overlay]} />}

      {!isNativeStreamingAvailable && appInBackground && (
        <View style={[StyleSheet.absoluteFill, styles.bgOverlay]}>
          <Feather name="pause-circle" size={56} color="rgba(255,255,255,0.4)" />
          <Text style={styles.bgText}>Stream paused</Text>
          <Text style={styles.bgSub}>Open app to resume</Text>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { stopStreaming(); router.back(); }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.statusRow}>
          {isStreaming ? (
            <>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
              {!isNativeStreamingAvailable && (
                <Text style={styles.fpsStat}>{frameCount} frames</Text>
              )}
              {isNativeStreamingAvailable && (
                <Text style={styles.fpsStat}>background</Text>
              )}
            </>
          ) : (
            <Text style={styles.offlineLabel}>
              {isNativeStreamingAvailable ? "READY" : connected ? "READY" : "CONNECTING..."}
            </Text>
          )}
        </View>

        {viewerCount > 0 && (
          <View style={styles.viewerBadge}>
            <Feather name="eye" size={13} color="#fff" />
            <Text style={styles.viewerCount}>{viewerCount}</Text>
          </View>
        )}
      </View>

      <View style={[styles.roomCard, { top: topPad + 70 }]}>
        <TouchableOpacity onPress={copyCode} activeOpacity={0.7} style={styles.codeRow}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.codeValue}>{roomId}</Text>
          <Feather
            name={copied ? "check" : "copy"}
            size={16}
            color={copied ? "#4ade80" : "rgba(255,255,255,0.5)"}
          />
        </TouchableOpacity>
      </View>

      {isNativeStreamingAvailable && (
        <View style={[styles.autoStartRow, { top: topPad + 135 }]}>
          <Feather name="refresh-cw" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.autoStartLabel}>Auto-start on boot</Text>
          <Switch
            value={autoStart}
            onValueChange={toggleAutoStart}
            trackColor={{ false: "rgba(255,255,255,0.15)", true: "#ff3b3b" }}
            thumbColor="#fff"
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: botPad + 24 }]}>
        <TouchableOpacity style={styles.linkBtn} onPress={copyLink} activeOpacity={0.8}>
          <Feather name="link" size={18} color="#fff" />
          <Text style={styles.linkBtnText}>Copy web link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.goLiveBtn,
            isStreaming
              ? { backgroundColor: "rgba(255,59,59,0.25)", borderColor: "#ff3b3b", borderWidth: 2 }
              : { backgroundColor: "#ff3b3b" },
          ]}
          onPress={isStreaming ? stopStreaming : startStreaming}
          activeOpacity={0.85}
        >
          {isStreaming ? (
            <>
              <View style={styles.stopIcon} />
              <Text style={[styles.goLiveBtnText, { color: "#ff3b3b" }]}>Stop</Text>
            </>
          ) : (
            <>
              <Feather name="video" size={22} color="#fff" />
              <Text style={styles.goLiveBtnText}>Go Live</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ width: 100 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  overlay: { backgroundColor: "rgba(0,0,0,0.45)" },
  bgOverlay: { backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", gap: 12 },
  bgText: { fontSize: 22, fontWeight: "700" as const, color: "#fff", marginTop: 8 },
  bgSub: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  statusRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#ff3b3b" },
  liveLabel: { fontSize: 14, fontWeight: "700" as const, color: "#fff", letterSpacing: 0.08 },
  offlineLabel: { fontSize: 13, fontWeight: "600" as const, color: "rgba(255,255,255,0.6)", letterSpacing: 0.06 },
  fpsStat: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  viewerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  viewerCount: { fontSize: 13, color: "#fff", fontWeight: "600" as const },
  roomCard: {
    position: "absolute", left: 16, right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  codeRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  codeLabel: { fontSize: 11, fontWeight: "700" as const, color: "rgba(255,255,255,0.5)", letterSpacing: 0.1 },
  codeValue: {
    flex: 1, fontSize: 22, fontWeight: "800" as const, color: "#fff",
    letterSpacing: 0.12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  autoStartRow: {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  autoStartLabel: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "500" as const },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20,
  },
  linkBtn: { width: 100, flexDirection: "column", alignItems: "center", gap: 4 },
  linkBtnText: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  goLiveBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 28, paddingVertical: 16, borderRadius: 40,
  },
  goLiveBtnText: { fontSize: 17, fontWeight: "700" as const, color: "#fff" },
  stopIcon: { width: 16, height: 16, borderRadius: 3, backgroundColor: "#ff3b3b" },
  permTitle: { fontSize: 22, fontWeight: "700" as const, marginTop: 16, textAlign: "center" },
  permSub: { fontSize: 15, textAlign: "center", lineHeight: 22, marginTop: 8 },
  permBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  permBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
  back: { fontSize: 15 },
});
