import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          RemoteCam
        </Text>
        <Text style={[styles.appSub, { color: colors.mutedForeground }]}>
          Stream your camera anywhere
        </Text>
      </View>

      <Animated.View style={[styles.heroArea, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.iconRing,
            {
              borderColor: "rgba(255,59,59,0.25)",
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: "rgba(255,59,59,0.12)" }]}>
            <Feather name="video" size={52} color={colors.primary} />
          </View>
        </Animated.View>

        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Live Camera Streaming
        </Text>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Broadcast your camera to any browser in real time. No account needed.
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.actionsArea,
          { paddingBottom: botPad + 32, opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/camera");
          }}
          activeOpacity={0.85}
        >
          <Feather name="video" size={22} color="#fff" />
          <Text style={styles.primaryBtnText}>Start Broadcasting</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/viewer");
          }}
          activeOpacity={0.8}
        >
          <Feather name="monitor" size={20} color={colors.foreground} />
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
            Watch a Stream
          </Text>
        </TouchableOpacity>

        <View style={styles.featuresRow}>
          <View style={styles.featureItem}>
            <Feather name="zap" size={16} color={colors.mutedForeground} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>
              Real-time
            </Text>
          </View>
          <View style={[styles.featureDot, { backgroundColor: colors.border }]} />
          <View style={styles.featureItem}>
            <Feather name="globe" size={16} color={colors.mutedForeground} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>
              Any browser
            </Text>
          </View>
          <View style={[styles.featureDot, { backgroundColor: colors.border }]} />
          <View style={styles.featureItem}>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>
              Room codes
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 15,
    marginTop: 3,
    fontWeight: "400" as const,
  },
  heroArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 20,
  },
  iconRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700" as const,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  actionsArea: {
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
    borderRadius: 16,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#fff",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  featureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
