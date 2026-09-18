// SignupScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

const API_URL = "http://10.247.145.239:3001"; // same as LoginScreen — keep in sync

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !phone || !password) {
      Alert.alert("Missing info", "Name, phone number and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone_number: phone, email, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        Alert.alert("Signup failed", data.error || "Something went wrong");
        return;
      }
      Alert.alert("Account created", `Welcome, ${data.name}!`);
      navigation.navigate("Login");
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", "Could not reach the server. Check API_URL and that backend is running.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join SafePath</Text>

      <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Creating..." : "Sign Up"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FFFFFF" },
  title: { fontSize: 28, fontWeight: "700", color: "#1F4E5F", textAlign: "center" },
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
    backgroundColor: "#1F4E5F",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  link: { color: "#2E86AB", textAlign: "center", marginTop: 20 },
});
