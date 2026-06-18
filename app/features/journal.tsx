import { Ionicons } from '@expo/vector-icons';
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { getUrl, list, remove } from 'aws-amplify/storage';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const POST_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/journal";
const GET_URL  = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/journal/list";
const GET_DAY_URL = POST_URL + "/day";

let userName = "";

async function build() {
  const user = await getCurrentUser();
  userName = user.username;
}

async function getDayNotes(date_str: string, idToken: string | undefined) {
  const response = await fetch(GET_DAY_URL, {
    method: "GET",
    headers: { Authorization: idToken, username: userName, date: date_str },
  });
  return await response.json();
}

async function getNotes() {
  await build();
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const response = await fetch(GET_URL, {
    method: "GET",
    headers: { Authorization: idToken, username: userName },
  });
  const days = await response.json();
  if (!Array.isArray(days)) return [[], idToken];
  const fullData = await Promise.all(
    days.map(async (date) => ({
      date,
      notes: await getDayNotes(date, idToken),
    }))
  );
  return [fullData, idToken];
}

async function updateNote(noteData: string, idToken: string) {
  await fetch(POST_URL, {
    method: "PUT",
    headers: {
      Authorization: idToken,
      username: userName,
      "Content-Type": "application/json",
    },
    body: noteData,
  });
}

async function deleteNote(noteId: string, idToken: string, path: string) {
  await fetch(POST_URL, {
    method: "DELETE",
    headers: { Authorization: idToken, username: userName, note_id: noteId },
  });
  try {
    await remove({ path });
  } catch {
    console.log("No image to delete");
  }
}

async function getImageForNote(date: string, noteId: string, user: string): Promise<string | null> {
  try {
    // Normalise to YYYY-MM-DD so the S3 prefix always matches the upload path
    const normalisedDate = new Date(date).toISOString().split("T")[0];
    const prefix = `public/${user}/journal/${normalisedDate}/`;
    const { items } = await list({ path: prefix });
    if (!items.length) return null;

    const imageItems = items.filter(item => /\.(png|jpg|jpeg|webp)$/i.test(item.path));
    if (!imageItems.length) return null;

    // 1. File lives inside a subfolder named after this note_id
    let match = imageItems.find(item => {
      const afterDate = item.path.split(`${normalisedDate}/`)[1] ?? '';
      const folderOrFile = afterDate.split('/')[0];
      return folderOrFile === noteId;
    });

    // 2. Flat file: note_id is the filename stem e.g. note_id.png
    if (!match) {
      match = imageItems.find(item => {
        const afterDate = item.path.split(`${normalisedDate}/`)[1] ?? '';
        return afterDate.replace(/\.[^.]+$/, '') === noteId;
      });
    }

    // 3. note_id is a prefix in the filename e.g. note_id_capture.jpg
    if (!match) {
      match = imageItems.find(item => {
        const filename = item.path.split('/').pop() ?? '';
        return filename.startsWith(noteId);
      });
    }

    if (!match) {
      console.log(`No image match for noteId: ${noteId}, available paths:`, imageItems.map(i => i.path));
      return null;
    }

    const urlResult = await getUrl({ path: match.path });
    return urlResult.url.toString();
  } catch (err) {
    console.error("Error fetching image:", err);
    return null;
  }
}

type Note = {
  note_id: string;
  plant_id: string;
  area_id: string;
  date_added: string;
  note_text: string;
};

type JournalEntry = {
  date: string;
  note: Note;
  imageUri: string | null;
};

export default function JournalApp() {
  const [entries, setEntries]               = useState<JournalEntry[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry]   = useState<JournalEntry | null>(null);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [editMode, setEditMode]             = useState(false);
  const [editedText, setEditedText]         = useState("");
  const [idTokenCache, setIdTokenCache]     = useState<string>("");
  const [animating, setAnimating]           = useState(true);

  const screenWidth  = Dimensions.get('window').width;
  const numColumns   = 2;
  const cardWidth    = (screenWidth - 48) / numColumns;

  useEffect(() => { setAnimating(true); }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fullData, idToken] = await getNotes() as [{ date: string; notes: Note[] }[], string];
      setIdTokenCache(idToken);
      const flat: JournalEntry[] = [];
      for (const day of fullData) {
        console.log(day.notes)
        for (const note of day.notes ?? []) {
          const imageUri = await getImageForNote(day.date, note.note_id, userName);
          flat.push({ date: day.date, note, imageUri });
        }
      }
      flat.sort((a, b) => b.date.localeCompare(a.date));
      setEntries(flat);
    } catch (err) {
      console.error(err);
      setError("Failed to load journal entries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const openEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setEditedText(entry.note.note_text);
    setEditMode(false);
    setFullscreenVisible(true);
  };

  const handleSave = async () => {
    if (!selectedEntry) return;
    const updated = { ...selectedEntry.note, note_text: editedText };
    await updateNote(JSON.stringify(updated), idTokenCache);
    setFullscreenVisible(false);
    loadEntries();
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    const normalisedDate = new Date(selectedEntry.date).toISOString().split("T")[0];
    const path = `public/${userName}/journal/${normalisedDate}/${selectedEntry.note.note_id}_capture.jpg`;
    await deleteNote(selectedEntry.note.note_id, idTokenCache, path);
    setFullscreenVisible(false);
    loadEntries();
  };

  const renderCard = ({ item }: { item: JournalEntry }) => (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={() => openEntry(item)}
      activeOpacity={0.85}
    >
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={[styles.cardImage, { width: cardWidth, height: cardWidth }]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.cardImagePlaceholder, { width: cardWidth, height: cardWidth }]}>
          <Ionicons name="leaf-outline" size={36} color="#81c784" />
          <Text style={styles.placeholderText}>No image</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardDate}>{item.date}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {item.note.note_text || "No note text"}
        </Text>
        {item.note.area_id && item.note.area_id !== " " && (
          <View style={styles.areaBadge}>
            <Ionicons name="location-outline" size={10} color="#514942" />
            <Text style={styles.areaBadgeText}>{item.note.area_id}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>YOUR GARDEN</Text>
            <Text style={styles.headerTitle}>Journal</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={loadEntries} disabled={loading}>
            <Ionicons name="refresh" size={18} color="#656e5f" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerDivider} />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#81c784" size="large" />
            <Text style={styles.loadingText}>Loading your journal…</Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && entries.length === 0 && !error && (
          <View style={styles.emptyContainer}>
            <Ionicons name="journal-outline" size={56} color="#a2aca4" />
            <Text style={styles.emptyText}>No entries yet</Text>
            <Text style={styles.emptySubtext}>Upload photos to get started.</Text>
          </View>
        )}

        <FlatList
          data={entries}
          keyExtractor={(item) => item.note.note_id}
          numColumns={numColumns}
          renderItem={renderCard}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
        />

        {/* Fullscreen Modal */}
        <Modal visible={fullscreenVisible} animationType="slide" onRequestClose={() => setFullscreenVisible(false)}>
          <View style={styles.fullscreenContainer}>

            <View style={styles.fullscreenHeader}>
              <TouchableOpacity onPress={() => setFullscreenVisible(false)} style={styles.backButton}>
                <Ionicons name="chevron-back" size={22} color="#323232" />
              </TouchableOpacity>
              <View style={styles.fullscreenHeaderCenter}>
                <Text style={styles.fullscreenEyebrow}>OBSERVATION</Text>
                <Text style={styles.fullscreenDate}>{selectedEntry?.date}</Text>
              </View>
              {!editMode ? (
                <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editButton}>
                  <Ionicons name="pencil" size={18} color="#656e5f" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setEditMode(false)} style={styles.editButton}>
                  <Ionicons name="close" size={18} color="#656e5f" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              {selectedEntry?.imageUri ? (
                <Image
                  source={{ uri: selectedEntry.imageUri }}
                  style={styles.fullscreenImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.fullscreenPlaceholder}>
                  <Ionicons name="leaf-outline" size={64} color="#a2aca4" />
                  <Text style={styles.placeholderText}>No image available</Text>
                </View>
              )}

              <View style={styles.notePanel}>
                {/* Area + Plant tags */}
                <View style={styles.tagRow}>
                  {selectedEntry?.note.area_id && selectedEntry.note.area_id !== " " && (
                    <View style={styles.tag}>
                      <Ionicons name="location-outline" size={11} color="#514942" />
                      <Text style={styles.tagText}>{selectedEntry.note.area_id}</Text>
                    </View>
                  )}
                  {selectedEntry?.note.plant_id && selectedEntry.note.plant_id !== " " && (
                    <View style={[styles.tag, styles.tagGreen]}>
                      <Ionicons name="leaf-outline" size={11} color="#2e5c31" />
                      <Text style={[styles.tagText, styles.tagTextGreen]}>{selectedEntry.note.plant_id}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.notePanelLabel}>NOTES</Text>
                {!editMode ? (
                  <Text style={styles.notePanelText}>
                    {selectedEntry?.note.note_text || "No note text."}
                  </Text>
                ) : (
                  <TextInput
                    value={editedText}
                    onChangeText={setEditedText}
                    style={styles.noteInput}
                    multiline
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                    placeholder="Edit your note…"
                    placeholderTextColor="#a2aca4"
                  />
                )}

                <View style={styles.metaDivider} />

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Area</Text>
                  <Text style={styles.metaValue}>{selectedEntry?.note.area_id || "—"}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Plant</Text>
                  <Text style={styles.metaValue}>{selectedEntry?.note.plant_id || "—"}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Added</Text>
                  <Text style={styles.metaValue}>{selectedEntry?.note.date_added || "—"}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.actionBar}>
              {editMode ? (
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Ionicons name="checkmark" size={18} color="#d0d7cc" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={18} color="#d0d7cc" />
                  <Text style={styles.deleteButtonText}>Delete Entry</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </Modal>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#d0d7c9",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 30,
    paddingBottom: 14,
    paddingHorizontal: 24,
    backgroundColor: "#d0d7c9",
  },
  headerEyebrow: {
    color: "#81c784",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 3,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Poppins_400Regular",
    color: "#323232",
    letterSpacing: -0.5,
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#656e5f",
    opacity: 0.25,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: "rgba(101,110,95,0.15)",
    borderRadius: 20,
    marginBottom: 4,
  },

  // Loading / Empty
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#656e5f",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingBottom: 60,
  },
  emptyText: {
    color: "#323232",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    marginTop: 12,
  },
  emptySubtext: {
    color: "#656e5f",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
  },

  // Grid
  grid: {
    padding: 12,
    paddingBottom: 40,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 14,
  },

  // Card
  card: {
    backgroundColor: "#c4ccbd",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(101,110,95,0.2)",
  },
  cardImage: { borderRadius: 0 },
  cardImagePlaceholder: {
    backgroundColor: "#b8c2b1",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  placeholderText: {
    color: "#656e5f",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  cardDate: {
    color: "#656e5f",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    color: "#323232",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    lineHeight: 17,
  },
  areaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(81,73,66,0.1)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  areaBadgeText: {
    color: "#514942",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 0.3,
  },

  // Fullscreen modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#d0d7c9",
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(101,110,95,0.2)",
    backgroundColor: "#d0d7c9",
  },
  fullscreenHeaderCenter: {
    alignItems: "center",
  },
  fullscreenEyebrow: {
    color: "#81c784",
    fontSize: 9,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 3,
  },
  fullscreenDate: {
    color: "#323232",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  backButton: {
    padding: 4,
    backgroundColor: "rgba(101,110,95,0.12)",
    borderRadius: 20,
  },
  editButton: {
    padding: 8,
    backgroundColor: "rgba(101,110,95,0.12)",
    borderRadius: 20,
  },
  fullscreenImage: {
    width: "100%",
    height: 320,
    backgroundColor: "#b8c2b1",
  },
  fullscreenPlaceholder: {
    width: "100%",
    height: 240,
    backgroundColor: "#b8c2b1",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  // Note panel
  notePanel: {
    padding: 22,
    gap: 10,
    backgroundColor: "#d0d7c9",
  },
  tagRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(81,73,66,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagGreen: {
    backgroundColor: "rgba(129,199,132,0.18)",
  },
  tagText: {
    color: "#514942",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  tagTextGreen: {
    color: "#2e5c31",
  },
  notePanelLabel: {
    color: "#81c784",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 2,
  },
  notePanelText: {
    color: "#323232",
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    lineHeight: 24,
  },
  noteInput: {
    backgroundColor: "#c4ccbd",
    borderWidth: 1,
    borderColor: "rgba(101,110,95,0.3)",
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
    color: "#323232",
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    textAlignVertical: "top",
  },
  metaDivider: {
    height: 1,
    backgroundColor: "#656e5f",
    opacity: 0.2,
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(101,110,95,0.12)",
  },
  metaLabel: {
    color: "#656e5f",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  metaValue: {
    color: "#323232",
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
  },

  // Action bar
  actionBar: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: "rgba(101,110,95,0.15)",
    backgroundColor: "#d0d7c9",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#514942",
    paddingVertical: 15,
    borderRadius: 12,
  },
  saveButtonText: {
    color: "#d0d7cc",
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#656e5f",
    paddingVertical: 15,
    borderRadius: 12,
  },
  deleteButtonText: {
    color: "#d0d7cc",
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
  },
  error: {
    color: "#514942",
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    textAlign: "center",
    padding: 16,
  },
});