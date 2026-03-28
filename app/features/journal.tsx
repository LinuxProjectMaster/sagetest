import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { getUrl, list } from 'aws-amplify/storage';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Keyboard, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';



const POST_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/journal" 
const GET_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/journal/list"
const GET_DAY_URL = POST_URL + "/day"
let userName = ""



function getDateFromPath(path) {
    const match = path.match(/\d{4}-\d{2}-\d{2}/);
    const date = match ? match[0] : null;
    return date

}


async function getDayNotes(date_str: any, idToken: string | undefined) {
    const response = await fetch(GET_DAY_URL, {
      method: "GET",
      headers: {
        Authorization: idToken,
        username: userName,
        date: date_str
      }})
      const noteData = await response.json()
      return noteData
  }

  async function getNotes() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    const response = await fetch(GET_URL, {
      method: "GET",
      headers: {
        Authorization: idToken,
        username: userName,
      },
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    const days = await response.json();
    console.log("days:", days);

    if (!Array.isArray(days)) {
      console.error("API did not return an array", days);
      return []; // or handle error
    }

    const fullData = await Promise.all(
      days.map(async (date) => ({
        date,
        notes: await getDayNotes(date, idToken)
      }))
    )

    return [fullData, idToken];
}

async function updateNote(noteData) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();

  const response = await fetch(POST_URL, {
    method: "PUT",
    headers: {
      Authorization: idToken,
      username: userName,
      "Content-Type": "application/json",
    },
    body: noteData,
  });

  console.log("Response status:", response.status);
  console.log("Response ok:", response.ok);

  const data = await response.json();
  console.log("Data:", data);
}


async function deleteNote(date, index) {
  const [noteData, idToken] = await getNotes();

  const dayEntry = noteData.find(d => d.date === date);
  if (!dayEntry) {
    throw new Error("Date not found");
  }

  const noteID = dayEntry.notes[index].note_id;
  const response = await fetch(POST_URL, {
    method: "DELETE",
    headers: {
      Authorization: idToken,
      username: userName,
      note_id: noteID
    },
  });

  console.log("Response status:", response.status);

  const data = await response.json();
}

function OthersJournals() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editedText, setEditedText] = useState("");


  const handleGetNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const [fullData] = await getNotes(); 
      setData(fullData);
    } catch (err) {
      console.error(err);
      setError("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const renderDay = ({ item }) => (
    <View style={styles.dayContainer}>
      <Text style={styles.date}>{item.date}</Text>

      {item.notes?.length ? (
        item.notes.map((note, index) => (
          <TouchableOpacity
            key={note.note_id}
            onPress={() => {
              setSelectedDate(item.date);
              setSelectedIndex(index);
              setEditedText(JSON.stringify(note));
              setEditMode(false);
              setNoteModalVisible(true);
            }}
          >
           <Text style={styles.note}>
            Plant ID: {note.plant_id}{"\n"}
            Note ID: {note.note_id}{"\n"}
            Area ID: {note.area_id}{"\n"}
            Date Added: {note.date_added}{"\n"}
            Text: {note.note_text}
          </Text>

          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.noNotes}>No notes</Text>
      )}

    </View>
  );

  return (
    <View style={styles.othersContainer}>

  <TouchableOpacity
    style={[
      styles.getNotesButton,
      loading && styles.buttonDisabled,
    ]}
    onPress={handleGetNotes}
    disabled={loading}
  >
    <Text style={styles.getNotesButtonText}>
      {loading ? "Loading..." : "Get Notes"}
    </Text>
  </TouchableOpacity>


      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={data}
        keyExtractor={(item) => item.date.toString()}
        renderItem={renderDay}
        contentContainerStyle={{ paddingVertical: 16 }}
      />
      <Modal visible={noteModalVisible} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.modalCard}>

      {!editMode ? (
        <>
          <Text style={styles.modalTitle}>Note Options</Text>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => setEditMode(true)}
          >
            <Text>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={async () => {
              await deleteNote(selectedDate, selectedIndex);
              setNoteModalVisible(false);
              handleGetNotes();
            }}
          >
            <Text style={{ color: "#fff" }}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setNoteModalVisible(false)}
            style={styles.cancelButton}
          >
            <Text>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.modalTitle}>Edit Note</Text>

          <TextInput
            value={editedText}
            onChangeText={setEditedText}
            style={styles.modalInput}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
            multiline
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={() => setEditMode(false)}
              style={styles.cancelButton}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={async () => {
                await updateNote(
                  editedText
                );
                setNoteModalVisible(false);
                setEditMode(false);
                handleGetNotes();
              }}
            >
              <Text style={{ color: "#fff" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

    </View>
  </View>
</Modal>

    </View>
    
  );
}


async function build() {
    const user = await getCurrentUser();
    userName = user.username
}

async function getImagesFromDirectory() {
  await build();

  try {
    const { items } = await list({
      path: `public/${userName}/journal`,
    });

    const photos = await Promise.all(
      items.map(async (item) => {
        const urlResult = await getUrl({ path: item.path });

        return {
          uri: urlResult.url.toString(),
          path: item.path,
        };
      })
    );

    return photos; // return ONE array
  } catch (error) {
    console.error("No images uploaded yet:", error);
    return [];
  }
}


function JournalGallery() {
  const [photos, setPhotos] = useState([]);
  const numColumns = 5;
  const screenWidth = Dimensions.get('window').width;
  const imageSize = screenWidth / numColumns - 10;

  React.useEffect(() => {
    async function fetchImages() {
      const photos = await getImagesFromDirectory();
      setPhotos(photos);
    }
    fetchImages();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={photos}
        keyExtractor={(item, index) => index.toString()}
        numColumns={numColumns}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Link
            style={styles.photo}
            href={{
              pathname: 'features/fullscreenimg',
              params: {
                imageURI: encodeURIComponent(item.uri),
                path: item.path,
              },
            }}
          >
            <Image
              source={{ uri: item.uri }}   // <-- also fix this
              style={[styles.photo, { width: imageSize, height: imageSize }]}
              contentFit="cover"
            />
          </Link>
        )}
      />
    </View>
  );
}


const Tab = createBottomTabNavigator();

export default function JournalApp() {
  return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'My Journal') {
              iconName = focused ? 'images' : 'images-outline';
            } else if (route.name === 'Access Notes') {
              iconName = focused ? 'albums' : 'albums-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#333',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            backgroundColor: '#fdf6e3',
            borderTopWidth: 1,
            borderTopColor: '#ddd',
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: 'bold',
          },
        })}
      >
        <Tab.Screen name="My Journal" component={JournalGallery} />
        <Tab.Screen name="Access Notes" component={OthersJournals} />
      </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf6e3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    position: "absolute",
    top: 30
  },
  photo: {
    margin: 5,
    borderRadius: 8,
  },
  othersContainer: {
    flex: 1,
    backgroundColor: '#fdf6e3',
    paddingHorizontal: 10,
    paddingTop: 5,
  },
  dayContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f2f2f2",
    borderRadius: 8,
  },
  date: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  note: {
    marginLeft: 8,
    fontSize: 11
  },
  noNotes: {
    fontStyle: "italic",
    color: "#666",
  },
  error: {
    color: "red",
    marginTop: 12,
  },
  getNotesButton: {
  backgroundColor: "#333",
  marginVertical: 10,
  paddingVertical: 12,
  borderRadius: 25,
  alignItems: "center",
  marginTop: 12,
},

getNotesButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "600",
},

buttonDisabled: {
  opacity: 0.5,
},
modalButton: {
  paddingVertical: 12,
},

confirmButton: {
  backgroundColor: "green",
  paddingVertical: 12,
  paddingHorizontal: 18,
  borderRadius: 8,
  minWidth: 90,
  alignItems: "center",
},

deleteButton: {
  backgroundColor: "#c0392b",
  paddingVertical: 12,
  paddingHorizontal: 18,
  borderRadius: 8,
  minWidth: 90,
  alignItems: "center",
  marginTop: 12,
},

cancelButton: {
  paddingVertical: 12,
  paddingHorizontal: 18,
  minWidth: 90,
  alignItems: "center",
},

noteRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 6,
},

noteActions: {
  flexDirection: "row",
  gap: 12,
},

modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.4)",
  justifyContent: "center",
  alignItems: "center",
},

modalCard: {
  width: "85%",
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: 16,
},

modalTitle: {
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 12,
},

modalInput: {
  borderWidth: 1,
  borderColor: "#ddd",
  borderRadius: 8,
  padding: 10,
  minHeight: 80,
  textAlignVertical: "top",
},

modalActions: {
  flexDirection: "row",
  justifyContent: "flex-end",
  marginTop: 16,
  gap: 12,
},


});
