import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider } from "react-native-paper";

import { AuthProvider, AuthContext } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import Dashboard from "./src/screens/Dashboard";

const Stack = createNativeStackNavigator();

const theme = {
  colors: {
    primary: "#22c55e",
    accent: "#22c55e",
    background: "#f5f5f5",
    surface: "#ffffff",
    text: "#1f2937",
    placeholder: "#9ca3af",
    disabled: "#d1d5db",
  },
};

function RootNavigator() {
  const { token } = useContext(AuthContext);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {token ? (
        <Stack.Screen name="Dashboard" component={Dashboard} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}
