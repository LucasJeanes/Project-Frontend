import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet } from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

// Send userID to backend, get JWT back
// Then when sending messages, send JWT in header and get username returned
// Then use that username to display messages
//const jwt = require('jsonwebtoken');

const Stack = createNativeStackNavigator();

const backendUrl = "https://fc9d-80-233-41-139.ngrok-free.app";

//get secure store working for tomorrow

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name = "Home" component={HomeScreen} />
        <Stack.Screen name="Accounts" component={AccountScreen} />
        <Stack.Screen name = "ActiveRoom" component={ActiveRoomScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AccountScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await fetch(`${backendUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Login failed: ${text}`);
      }

      const data = await res.json();
      if (data.token) {
        await SecureStore.setItemAsync('jwt', data.token);
        console.log("Login successful. JWT stored: ", data.token);
        navigation.navigate('Home');
      } else {
        throw new Error('No token received');
      }
    } catch (err) {
      console.error('Login error:', err.message);
    }
  };

  const handleSignup = async () => {
    try {
      const res = await fetch(`${backendUrl}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Signup failed: ${text}`);
      }

      const data = await res.json();
      console.log("Signup successful. You may now log in.");
    } catch (err) {
      console.error('Signup error:', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
      <Button title="Sign Up" onPress={handleSignup} />
    </View>
  );
}


function HomeScreen({ navigation }) {
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState([]);

  const fetchRooms = async () => {
    try {
      const token = await SecureStore.getItemAsync('jwt');
      console.log('token:', token);
      if (!token) throw new Error("No token available");

      const res = await fetch(`${backendUrl}/rooms`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fetch failed: ${text}`);
      }

      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error('Error fetching rooms:', err.message);
    }
  };


  const createRoom = async () => {
    try {
      const token = await SecureStore.getItemAsync('jwt');
      if (!token) throw new Error("No token available");

      const res = await fetch(`${backendUrl}/rooms/create`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: roomName })
      });

      const data = await res.json();
      await fetchRooms();
      console.log('Created room:', data);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let intervalId;
  
      const fetch = async () => {
        const token = await SecureStore.getItemAsync('jwt');
        if (token) {
          await fetchRooms();
          intervalId = setInterval(fetchRooms, 5000);
        } else {
          console.warn("JWT not found — skipping initial fetch");
        }
      };
  
      fetch();
  
      // Cleanup when screen is not focused
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }, [])
  );
  

    return (
      <View style={styles.container}>
        <Button
          title="Login / Register"
          onPress={() =>
          navigation.navigate("Accounts")
          }
        />
        <TextInput
          style={styles.input}
          value={roomName}
          onChangeText={setRoomName}
          placeholder="Enter room name"
        />
        <Button title="Create Room" onPress={createRoom} />
        <ScrollView style={styles.roomList}>
          {Object.keys(rooms).map((roomId) => (
            <View key={roomId} style={styles.roomCard}>
              <Text style={styles.roomId}>
                {rooms[roomId]?.roomName || 'Unnamed Room'} 
                (ID: {roomId})
              </Text>
              <Button
                title="Join Room"
                onPress={() =>
                navigation.navigate("ActiveRoom", {
                  roomId,
                  wsUrl: `wss://${new URL(backendUrl).host}/rooms/${roomId}`,
                })
                }
              />
            </View>
          ))}
          </ScrollView>
        </View>
    );
}




// James: message
function ActiveRoomScreen({ route }) {
  const { roomId, wsUrl } = route.params; //route.params returns object
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    connectWebSocket(wsUrl);
    return () => socketRef.current?.close();
  }, [wsUrl]);
  
  const connectWebSocket = async (wsUrl) => {
    socketRef.current = new WebSocket(wsUrl);

    const token = await SecureStore.getItemAsync('jwt');  
    if (!token) throw new Error("No token available");

    socketRef.current.onopen = () => {
      console.log('Connected to WebSocket');
      socketRef.current.send(token);
    };

    socketRef.current.onmessage = (event) => {
      setMessages(prev => [...prev, event.data]);
    };

    socketRef.current.onclose = () => {
      console.log('WebSocket closed');
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const sendMessage = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(input);
      setInput('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Room ID: {roomId}</Text>
      <ScrollView style={styles.messages}>
        {messages.map((msg, idx) => (
          <Text key={idx}>{msg}</Text>
        ))}
      </ScrollView>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="Type message"
      />
      <Button title="Send" onPress={sendMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  scroll: { marginTop: 20 },
  roomCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10
  },
  roomId: {
    fontWeight: 'bold',
    marginBottom: 5
  },
  header: { fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  messages: { flex: 1, marginBottom: 10 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 }
});