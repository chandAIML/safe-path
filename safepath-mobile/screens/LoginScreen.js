// LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

// Change this to your backend's address:
// - Android emulator: http://10.247.145.239:3001
// - Real phone (Expo Go): http://<your-computer's-local-IP>:3000
const API_URL = "http://10.247.145.239:3001";

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert("Missing info", "Please enter phone number and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        Alert.alert("Login failed", data.error || "Something went wrong");
        return;
      }
      Alert.alert("Success", `Welcome back, ${data.name}!`);
      // In a full app: save data.token securely and navigate to Home screen
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", "Could not reach the server. Check API_URL and that backend is running.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SafePath</Text>
      <Text style={styles.subtitle}>Login to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FFFFFF" },
  title: { fontSize: 32, fontWeight: "700", color: "#1F4E5F", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#595959", textAlign: "center", marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#D0D7DA",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2E86AB",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  link: { color: "#2E86AB", textAlign: "center", marginTop: 20 },
});
