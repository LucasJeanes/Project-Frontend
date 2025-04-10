import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet, Image } from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

// Send userID to backend, get JWT back
// Then when sending messages, send JWT in header and get username returned
// Then use that username to display messages
//const jwt = require('jsonwebtoken');

const Stack = createNativeStackNavigator();

//const backendUrl = "https://075e-80-233-37-38.ngrok-free.app";
const backendUrl = "https://bbcbrian.arraylist.me";

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Accounts" component={AccountScreen} />
        <Stack.Screen name="ActiveRoom" component={ActiveRoomScreen} />
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
      console.log('Login error:', err.message);
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
      console.log('Signup error:', err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await SecureStore.setItemAsync('jwt', '');
      console.log("Logged out successfully.");
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (err) {
      console.log('Logout error:', err.message);
    }
  }

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
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}


function HomeScreen({ navigation }) {
  const [userId, setUserId] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState([]);

  const getUserIdFromToken = async () => {
    const token = await SecureStore.getItemAsync('jwt');
    if (!token) {
      console.warn("No JWT found");
    }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub;
      } catch (err) {
        console.log("Error decoding JWT:", err);
        return null;
      }
  };

  useEffect(() => {
    let isMounted = true;

    getUserIdFromToken().then((id) => {
      console.log("Decoded userId from JWT:", id);
      if (isMounted) setUserId(id);
    });

    return () => { isMounted = false };
  }, []);

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
      console.log('Rooms data:', data);

      setRooms(data);
    } catch (err) {
      console.log('Error fetching rooms:', err.message);
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
      console.log('Failed to create room:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let intervalId;

      const fetch = async () => {
        const token = await SecureStore.getItemAsync('jwt');
       if (token) {
          const userId = await getUserIdFromToken(); 
          console.log("Refreshed userId from JWT:", userId);
          setUserId(userId);

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

    const deleteRoom = async (roomId) => {
      try {
        const token = await SecureStore.getItemAsync('jwt');
        const res = await fetch(`${backendUrl}/rooms/${roomId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Failed to delete room: ${err}`);
        }
        
        console.log(`Room ${roomId} deleted successfully`);
        await fetchRooms();
      } catch (err) {
          console.log('Error deleting room:', err.message);
        }
    };

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
        {Object.entries(rooms).map(([roomId, roomObj]) => (
          <View key={roomId} style={styles.roomCard}>
            <Text style={styles.roomId}>
              {roomObj.roomName || 'Unnamed Room'}
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
            {userId && userId === roomObj.creatorUserId && (
              <Button
                title="Delete Room"
                color="red"
                onPress={() => deleteRoom(roomId)}
              />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function ActiveRoomScreen({ route }) {
  const [imageDataUri, setImageDataUri] = useState(null);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const { roomId, wsUrl } = route.params; //route.params returns object
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);
  const [image, setImage] = useState(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    console.log("imageDataUri preview:", imageDataUri?.slice(0, 50));

    connectWebSocket(wsUrl);
    return () => socketRef.current?.close();
  }, [wsUrl]);

  const pickAndSendImage = async () => {
    const token = await SecureStore.getItemAsync('jwt');
    if (!token) {
      console.warn("JWT missing");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      console.warn("Permission to access gallery denied");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const image = result.assets[0];

      setImage(image);
      /*
      const formData = new FormData();
  
      formData.append('chatImage', {
        uri: image.uri,
        type: 'image/jpeg',
        name: 'upload.jpg'
      });
  
      formData.append('content', 'the message'); // optional caption
  
      try {
        const res = await fetch(`${backendUrl}/rooms/${roomId}/image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData
        });
  
        if (!res.ok) {
          const errText = await res.text();
          console.error("Image upload failed:", errText);
        } else {
          console.log("Image sent successfully");
        }
      } catch (e) {
        console.error("Error sending image:", e);
      }
      */
    }
  };

  const connectWebSocket = async (wsUrl) => {
    socketRef.current = new WebSocket(wsUrl);

    const token = await SecureStore.getItemAsync('jwt');
    if (!token) throw new Error("Please Sign in");

    socketRef.current.onopen = async () => {
      console.log('Connected to WebSocket');
      socketRef.current.send(token);

      // GET HISTORY OF MESSAGES
      const response = await fetch(`${backendUrl}/rooms/${roomId}/messages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const messages = JSON.parse(await response.json());

      // console.log(messages);

      try {
        for (let i = 0; i < messages.length; i++) {
          const data = messages[i];
          if (data.messageType === "image") {
            // FETCH THE FUCKING IMAGE
            const imageName = data.imagePath;
            console.log("fetching IMAGE");
            await fetchImage(imageName, data.createdAt, data.username, data.content);
          } else {
            if (data.username && data.content) {
              const formattedMessage = `${new Date(data.createdAt).toLocaleTimeString()} ${data.username}: ${data.content}`;
              const obj = {
                msg: formattedMessage,
                type: "text"
              }
              setMessages(prev => [...prev, { msg: formattedMessage, type: "text" }]);
            } else {
              // Fallback for plain strings (e.g., "Someone joined the room!")
              setMessages(prev => [...prev, { msg: event.data, type: "text" }]);
            }
          }
        }
      } catch (e) {
        console.log("Error while fetching history", e);
      }

    };

    const fetchImage = async (name, createdAt, username, content) => {
      try {
        const token = await SecureStore.getItemAsync('jwt');
        const imageUrl = `${backendUrl}/images/${name}`; // Your image filename

        const response = await fetch(imageUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });


        // console.log(await response.json());
        // if (!response.ok) throw new Error('Image fetch failed');
        console.log("response.ok", response.ok);

        // const text = await response.json();

        const blob = await response.blob();
        const reader = new FileReader();

        reader.onloadend = () => {
          setImageDataUri(reader.result);
          const formattedMessage = `${new Date(createdAt).toLocaleTimeString()} ${username}: ${content}`;
          const obj = {
            msg: formattedMessage,
            type: "image",
            uri: reader.result
          }
          setMessages(prev => [
            ...prev,
            obj
          ]);
          setIsLoadingImage(false);
        };

        reader.onerror = (err) => {
          console.log("Error reading blob:", err);
          setIsLoadingImage(false);
        };

        reader.readAsDataURL(blob);
      } catch (err) {
        console.log("Error loading image:", err.message);
        setIsLoadingImage(false);
      }
    };


    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.messageType === "image") {
          // FETCH THE FUCKING IMAGE
          const imageName = data.imagePath;
          console.log("fetching IMAGE");
          fetchImage(imageName, data.createdAt, data.username, data.content);



        } else {
          if (data.username && data.content) {
            const formattedMessage = `${new Date(data.createdAt).toLocaleTimeString()} ${data.username}: ${data.content}`;
            const obj = {
              msg: formattedMessage,
              type: "text"
            }
            setMessages(prev => [...prev, { msg: formattedMessage, type: "text" }]);
          } else {
            // Fallback for plain strings (e.g., "Someone joined the room!")
            setMessages(prev => [...prev, { msg: event.data, type: "text" }]);
          }
        }
      } catch (err) {
        // In case it's not JSON (e.g., plain "user joined" message)
        setMessages(prev => [...prev, { msg: event.data, type: "text" }]);
      }
    };


    socketRef.current.onclose = () => {
      console.log('WebSocket closed');
    };

    socketRef.current.onerror = (error) => {
      console.log('WebSocket error:', error);
    };
  };

  const sendMessage = async () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log("running sendMessage")
      if (image !== null) { // send image
        const token = await SecureStore.getItemAsync('jwt');

        const formData = new FormData();

        formData.append('chatImage', {
          uri: JSON.parse(JSON.stringify(image.uri)),
          type: 'image/jpeg',
          name: 'upload.jpg'
        });

        setImage(null);
        setInput('');

        formData.append('content', JSON.parse(JSON.stringify(input))); // optional caption

        try {
          const res = await fetch(`${backendUrl}/rooms/${roomId}/image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
            body: formData
          });

          if (!res.ok) {
            const errText = await res.text();
            console.log("Image upload failed:", errText);
          } else {

            console.log("Image sent successfully");
          }
        } catch (e) {
          console.log("Error sending image:", e);
        }

      } else { // send normal message
        socketRef.current.send(input);
        console.log('Message sent:', input);
        setInput('');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Room ID: {roomId}</Text>
      <ScrollView
        style={styles.messages}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })} // Auto-scroll to the bottom      
      >
        {messages.map((msg, idx) => (
          msg.type === "text" ?
            <Text key={idx}>{msg.msg}</Text> :
            <View key={idx}>

              <Text>{msg.msg}</Text>
              <Image
                source={{ uri: msg.uri }}
                style={{ width: 300, height: 200 }}
                resizeMode="contain"

              />
            </View>
        ))}
      </ScrollView>
      { }
      <Button title="Attach Image" onPress={pickAndSendImage} />
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