import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();
const backendUrl = "https://b206-80-233-49-11.ngrok-free.app";

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name = "Home" component={HomeScreen} />
        <Stack.Screen name = "ActiveRoom" component={ActiveRoomScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeScreen({ navigation }) {
 const [roomName, setRoomName] = useState('');
 const [rooms, setRooms] = useState([]);

 const fetchRooms = async () => {
  try {
    const res = await fetch(`${backendUrl}/rooms`);
    const data = await res.json();
    setRooms(data);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    }
  };

  const createRoom = async () => {
    try {
      const res = await fetch(`${backendUrl}/rooms/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName })
      });
      const data = await res.json();
      await fetchRooms();
      console.log('Created room:', data);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
    }, []);
    return (
      <View style={styles.container}>
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
                {rooms[roomId]?.name || 'Unnamed Room'} 
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

function ActiveRoomScreen({ route }) {
  const { roomId, wsUrl } = route.params; //route.params returns object
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    connectWebSocket(wsUrl);
    return () => socketRef.current?.close();
  }, [wsUrl]);

  const connectWebSocket = (wsUrl) => {
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('Connected to WebSocket');
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