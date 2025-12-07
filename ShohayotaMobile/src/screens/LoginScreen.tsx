import React, { useState, useContext } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { TextInput, Button, Card } from "react-native-paper";
import { Building2 } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";

export default function LoginScreen() {
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const doLogin = async () => {
    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      alert("Login failed: " + (e.response?.data?.error || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconContainer}>
          <View style={styles.iconWrapper}>
            <Building2 size={40} color="#fff" />
          </View>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Sohayota CRM</Text>
            <Text style={styles.subtitle}>Multi-Tenant Customer Management System</Text>
            <Text style={styles.bengali}>সহায়তা</Text>

            <View style={styles.form}>
              <TextInput
                label="Email"
                mode="outlined"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="admin@dhakatech.com"
                style={styles.input}
                left={<TextInput.Icon icon="email" />}
              />

              <TextInput
                label="Password"
                mode="outlined"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
              />

              <Button
                mode="contained"
                onPress={doLogin}
                loading={isLoading}
                disabled={isLoading}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <Text style={styles.demoText}>
                Demo: admin@dhakatech.com / demo123
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    elevation: 4,
    borderRadius: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 4,
    color: "#6b7280",
  },
  bengali: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    color: "#9ca3af",
  },
  form: {
    marginTop: 8,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 8,
    paddingVertical: 4,
    backgroundColor: "#22c55e",
  },
  buttonContent: {
    paddingVertical: 8,
  },
  demoText: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 12,
    color: "#9ca3af",
  },
});
