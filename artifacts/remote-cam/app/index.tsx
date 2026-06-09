import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const botPad = Platform.OS === "web" ? 40 : insets.bottom;

  const goCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/camera");
  };

  const goViewer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/viewer");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad },
      ]}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Feather name="video" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>RemoteCam</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Stream your camera live to any device
        </Text>
      </View>

      {/* Action cards */}
      <View style={styles.cards}>
        {/* Go Live */}
        <TouchableOpacity
          style={[styles.card, styles.primaryCard]}
          onPress={goCamera}
          activeOpacity={0.85}
        >
          <View style={styles.cardIcon}>
            <Feather name="radio" size={28} color="#fff" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Go Live</Text>
            <Text style={styles.cardSub}>
              Stream your camera in the background — even when the screen is off
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* Watch Stream */}
        <TouchableOpacity
          style={[styles.card, styles.secondaryCard, { borderColor: colors.border }]}
          onPress={goViewer}
          activeOpacity={0.85}
        >
          <View style={[styles.cardIcon, styles.secondaryIcon]}>
            <Feather name="monitor" size={28} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Watch Stream</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Enter a room code to watch a live stream from any camera
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Footer note */}
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Streams are encrypted end-to-end via WebSocket
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  header: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,149,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  cards: {
    gap: 14,
    marginBottom: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  primaryCard: {
    backgroundColor: "#ff9500",
  },
  secondaryCard: {
    backgroundColor: "#1c1c1e",
    borderWidth: 1,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryIcon: {
    backgroundColor: "rgba(255,149,0,0.12)",
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#fff",
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.75)",
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    paddingTop: 8,
  },
});
