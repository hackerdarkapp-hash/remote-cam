import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { io, type Socket } from "socket.io-client";
import { useColors } from "@/hooks/useColors";

type StreamStatus = "idle" | "connecting" | "waiting" | "live" | "offline";

export default function ViewerScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const socketRef = useRef<Socket | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost";

  useEffect(() => {
    if (status === "live") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status]);

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus("idle");
    setCurrentFrame(null);
    setFrameCount(0);
  };

  const connect = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 3) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("connecting");

    const socket = io(`https://${domain}`, {
      path: "/api/socket.io/",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("viewer-join", { roomId: code });
      setStatus("waiting");
    });

    socket.on("connect_error", () => {
      setStatus("idle");
      socket.disconnect();
    });

    socket.on("camera-online", () => {
      setStatus("live");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    socket.on("camera-offline", () => {
      setStatus("offline");
      setCurrentFrame(null);
    });

    socket.on("frame", ({ frame }: { frame: string }) => {
      setCurrentFrame(frame);
      setStatus("live");
      setFrameCount((c) => c + 1);
    });

    socket.on("disconnect", () => {
      setStatus("idle");
      setCurrentFrame(null);
    });
  };

  const isConnected = status !== "idle";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { disconnect(); router.back(); }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Watch Stream</Text>

        {status === "live" && (
          <View style={styles.livePill}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
        )}
      </View>

      <View style={[styles.streamBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {currentFrame ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${currentFrame}` }}
            style={styles.streamImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            {status === "idle" && (
              <>
                <Feather name="monitor" size={48} color={colors.mutedForeground} />
                <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                  Enter a room code to watch
                </Text>
              </>
            )}
            {status === "connecting" && (
              <>
                <Feather name="loader" size={40} color={colors.primary} />
                <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                  Connecting...
                </Text>
              </>
            )}
            {status === "waiting" && (
              <>
                <Feather name="clock" size={40} color={colors.mutedForeground} />
                <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                  Connected — waiting for camera to go live
                </Text>
              </>
            )}
            {status === "offline" && (
              <>
                <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
                <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                  Camera went offline
                </Text>
              </>
            )}
          </View>
        )}

        {currentFrame && (
          <View style={styles.frameCountBadge}>
            <Text style={styles.frameCountText}>{frameCount} frames</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.inputArea, { paddingBottom: botPad + 20 }]}
      >
        {!isConnected ? (
          <>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>ROOM CODE</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
                value={roomCode}
                onChangeText={(t) => setRoomCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="XXXXXX"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={connect}
              />
              <TouchableOpacity
                style={[
                  styles.connectBtn,
                  { backgroundColor: roomCode.length >= 4 ? colors.primary : colors.card, borderColor: colors.border },
                ]}
                onPress={connect}
                disabled={roomCode.length < 4}
                activeOpacity={0.8}
              >
                <Text style={[styles.connectBtnText, { color: roomCode.length >= 4 ? "#fff" : colors.mutedForeground }]}>
                  Watch
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Get the 6-character room code from the camera phone
            </Text>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.disconnectBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={disconnect}
            activeOpacity={0.8}
          >
            <Feather name="x-circle" size={18} color={colors.mutedForeground} />
            <Text style={[styles.disconnectText, { color: colors.mutedForeground }]}>
              Disconnect from room {roomCode.toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" as const },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(220,38,38,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ff3b3b" },
  livePillText: { fontSize: 12, fontWeight: "700" as const, color: "#ff3b3b", letterSpacing: 0.05 },
  streamBox: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  streamImage: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  placeholderText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  frameCountBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  frameCountText: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  inputArea: { paddingHorizontal: 20, paddingTop: 20, gap: 8 },
  inputLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.1, marginBottom: 4 },
  inputRow: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: "700" as const,
    letterSpacing: 0.15,
    borderWidth: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  connectBtn: {
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  connectBtnText: { fontSize: 16, fontWeight: "700" as const },
  hint: { fontSize: 12, marginTop: 4 },
  disconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  disconnectText: { fontSize: 15, fontWeight: "500" as const },
});
