import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, type BarcodeScanningResult } from "expo-camera";

import { colors } from "../theme";

type Props = {
  onScanned: (data: string) => void;
  onCancel: () => void;
};

/**
 * Inline QR preview - onBarcodeScanned must never be removed (Expo Go Android crash).
 */
export function InlineQrCamera({ onScanned, onCancel }: Props) {
  const [mounted, setMounted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const doneRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 300);
    return () => {
      clearTimeout(t);
      doneRef.current = true;
      readyRef.current = false;
    };
  }, []);

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (doneRef.current || !readyRef.current) return;
      doneRef.current = true;
      onScanned(result.data);
    },
    [onScanned],
  );

  const onCameraReady = useCallback(() => {
    readyRef.current = true;
    setCameraReady(true);
  }, []);

  if (!mounted) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Starting camera…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onCameraReady={onCameraReady}
        onBarcodeScanned={handleScan}
      />
      {!cameraReady ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
      <Pressable style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel scan</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 280 },
  camera: { flex: 1, borderRadius: 12, overflow: "hidden" },
  centered: { height: 280, justifyContent: "center", alignItems: "center" },
  muted: { color: colors.muted, marginTop: 8 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
  },
  cancelBtn: { marginTop: 12, alignItems: "center", padding: 8 },
  cancelText: { color: colors.accent, fontSize: 14 },
});
