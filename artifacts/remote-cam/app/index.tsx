import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");
const BTN_GAP = 12;
const BTN_SIZE = (SCREEN_W - BTN_GAP * 5) / 4;

type BtnType = "number" | "operator" | "special" | "equals";

interface CalcButton {
  label: string;
  type: BtnType;
  wide?: boolean;
  action: string;
}

const BUTTONS: CalcButton[][] = [
  [
    { label: "AC", type: "special", action: "clear" },
    { label: "+/-", type: "special", action: "toggle" },
    { label: "%", type: "special", action: "percent" },
    { label: "÷", type: "operator", action: "/" },
  ],
  [
    { label: "7", type: "number", action: "7" },
    { label: "8", type: "number", action: "8" },
    { label: "9", type: "number", action: "9" },
    { label: "×", type: "operator", action: "*" },
  ],
  [
    { label: "4", type: "number", action: "4" },
    { label: "5", type: "number", action: "5" },
    { label: "6", type: "number", action: "6" },
    { label: "−", type: "operator", action: "-" },
  ],
  [
    { label: "1", type: "number", action: "1" },
    { label: "2", type: "number", action: "2" },
    { label: "3", type: "number", action: "3" },
    { label: "+", type: "operator", action: "+" },
  ],
  [
    { label: "0", type: "number", wide: true, action: "0" },
    { label: ".", type: "number", action: "." },
    { label: "=", type: "equals", action: "equals" },
  ],
];

function formatDisplay(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-6 && num !== 0)) {
    return num.toExponential(4);
  }
  const parts = value.split(".");
  const intPart = parseInt(parts[0] ?? "0", 10).toLocaleString("en-US");
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
}

function getFontSize(display: string): number {
  const len = display.replace(/,/g, "").length;
  if (len <= 6) return 80;
  if (len <= 9) return 64;
  if (len <= 12) return 48;
  return 36;
}

export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();

  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [justCalculated, setJustCalculated] = useState(false);
  const [activeOperator, setActiveOperator] = useState<string | null>(null);

  const calculate = useCallback(
    (prev: string, curr: string, op: string): string => {
      const a = parseFloat(prev);
      const b = parseFloat(curr);
      switch (op) {
        case "+":
          return String(a + b);
        case "-":
          return String(a - b);
        case "*":
          return String(a * b);
        case "/":
          return b === 0 ? "Error" : String(a / b);
        default:
          return curr;
      }
    },
    []
  );

  const handleAction = useCallback(
    (action: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if ("0123456789".includes(action) || action === ".") {
        if (action === "." && display.includes(".") && !waitingForOperand) return;

        if (waitingForOperand || justCalculated) {
          setDisplay(action === "." ? "0." : action);
          setWaitingForOperand(false);
          setJustCalculated(false);
        } else {
          if (display === "0" && action !== ".") {
            setDisplay(action);
          } else if (display.replace(/[^0-9]/g, "").length < 12) {
            setDisplay(display + action);
          }
        }
        return;
      }

      if (action === "clear") {
        setDisplay("0");
        setExpression("");
        setPreviousValue(null);
        setOperator(null);
        setWaitingForOperand(false);
        setJustCalculated(false);
        setActiveOperator(null);
        return;
      }

      if (action === "toggle") {
        if (display !== "0" && display !== "Error") {
          setDisplay(display.startsWith("-") ? display.slice(1) : "-" + display);
        }
        return;
      }

      if (action === "percent") {
        if (display !== "Error") {
          const val = parseFloat(display) / 100;
          setDisplay(String(val));
        }
        return;
      }

      if (["+", "-", "*", "/"].includes(action)) {
        setActiveOperator(action);
        setJustCalculated(false);

        if (previousValue !== null && operator && !waitingForOperand) {
          const result = calculate(previousValue, display, operator);
          setDisplay(result);
          setPreviousValue(result);
          setExpression(
            `${formatDisplay(result)} ${action === "*" ? "×" : action === "/" ? "÷" : action}`
          );
        } else {
          setPreviousValue(display);
          setExpression(
            `${formatDisplay(display)} ${action === "*" ? "×" : action === "/" ? "÷" : action}`
          );
        }
        setOperator(action);
        setWaitingForOperand(true);
        return;
      }

      if (action === "equals") {
        if (previousValue !== null && operator) {
          const result = calculate(previousValue, display, operator);
          const opSymbol =
            operator === "*" ? "×" : operator === "/" ? "÷" : operator;
          setExpression(
            `${formatDisplay(previousValue)} ${opSymbol} ${formatDisplay(display)} =`
          );
          setDisplay(result);
          setPreviousValue(null);
          setOperator(null);
          setWaitingForOperand(false);
          setJustCalculated(true);
          setActiveOperator(null);
        }
      }
    },
    [display, previousValue, operator, waitingForOperand, justCalculated, calculate]
  );

  const getBgColor = (btn: CalcButton): string => {
    if (btn.type === "operator") {
      return activeOperator === btn.action && waitingForOperand
        ? "#ffffff"
        : "#ff9500";
    }
    if (btn.type === "special") return "#a5a5a5";
    if (btn.type === "equals") return "#ff9500";
    return "#333333";
  };

  const getTextColor = (btn: CalcButton): string => {
    if (btn.type === "operator" && activeOperator === btn.action && waitingForOperand) {
      return "#ff9500";
    }
    return "#ffffff";
  };

  const botPad = Platform.OS === "web" ? 20 : insets.bottom;
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const displayLabel = display === "Error" ? "Error" : formatDisplay(display);
  const fontSize = getFontSize(displayLabel);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.displayArea, { paddingTop: topPad + 20, paddingBottom: 20 }]}>
        <Text style={styles.expression} numberOfLines={1}>
          {expression}
        </Text>
        <Text
          style={[styles.displayText, { fontSize }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.4}
        >
          {displayLabel}
        </Text>
      </View>

      <View style={[styles.buttonGrid, { paddingBottom: botPad + 16 }]}>
        {BUTTONS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((btn) => {
              const btnWidth = btn.wide
                ? BTN_SIZE * 2 + BTN_GAP
                : BTN_SIZE;

              return (
                <TouchableOpacity
                  key={btn.action}
                  style={[
                    styles.button,
                    {
                      width: btnWidth,
                      height: BTN_SIZE,
                      borderRadius: BTN_SIZE / 2,
                      backgroundColor: getBgColor(btn),
                    },
                    btn.wide && styles.wideButton,
                  ]}
                  onPress={() => handleAction(btn.action)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      btn.type === "special" && styles.specialText,
                      { color: getTextColor(btn) },
                    ]}
                  >
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "flex-end",
  },
  displayArea: {
    paddingHorizontal: 24,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    flex: 1,
  },
  expression: {
    fontSize: 22,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 6,
    fontWeight: "400" as const,
  },
  displayText: {
    color: "#ffffff",
    fontWeight: "200" as const,
    letterSpacing: -2,
    textAlign: "right",
  },
  buttonGrid: {
    paddingHorizontal: BTN_GAP,
    gap: BTN_GAP,
  },
  row: {
    flexDirection: "row",
    gap: BTN_GAP,
    justifyContent: "center",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  wideButton: {
    alignItems: "flex-start",
    paddingLeft: BTN_SIZE / 2 - 4,
  },
  buttonText: {
    fontSize: 34,
    fontWeight: "400" as const,
    color: "#ffffff",
  },
  specialText: {
    color: "#000000",
    fontSize: 30,
    fontWeight: "500" as const,
  },
});
