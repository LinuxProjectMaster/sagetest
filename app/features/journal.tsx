import { Ionicons } from '@expo/vector-icons';
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { getUrl, remove } from 'aws-amplify/storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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

async function deleteNote(noteId: string, idToken: string, photos: Photo[]) {
  await fetch(POST_URL, {
    method: "DELETE",
    headers: { Authorization: idToken, username: userName, note_id: noteId },
  });
  await Promise.all(
    photos.map(async (p) => {
      try {
        await remove({ path: p.s3_key });
      } catch {
        console.log("No image to delete:", p.s3_key);
      }
    })
  );
}

async function resolvePhotoUrls(photos: Photo[] | undefined): Promise<string[]> {
  if (!photos?.length) return [];
  const urls = await Promise.all(
    photos.map(async (p) => {
      try {
        const urlResult = await getUrl({ path: p.s3_key });
        return urlResult.url.toString();
      } catch (err) {
        console.error("Error fetching image:", p.s3_key, err);
        return null;
      }
    })
  );
  return urls.filter((u): u is string => !!u);
}

type Photo = {
  s3_key: string;
  comment?: string;
};

type Note = {
  note_id: string;
  plant_id: string;
  area_id: string;
  date_added: string;
  note_text: string;
  photos?: Photo[];
};

type JournalEntry = {
  date: string;
  note: Note;
  photoUrls: string[];
};

export default function JournalApp() {
  const router = useRouter();
  const [entries, setEntries]               = useState<JournalEntry[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry]   = useState<JournalEntry | null>(null);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [editMode, setEditMode]             = useState(false);
  const [editedText, setEditedText]         = useState("");
  const [idTokenCache, setIdTokenCache]     = useState<string>("");
  const [animating, setAnimating]           = useState(true);
  const [searchQuery, setSearchQuery]       = useState("");
  const [viewMode, setViewMode]             = useState<'recent' | 'older'>('recent');

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
        for (const note of day.notes ?? []) {
          const photoUrls = await resolvePhotoUrls(note.photos);
          flat.push({ date: day.date, note, photoUrls });
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

  const isRecent = (dateStr: string) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return new Date(dateStr) >= cutoff;
  };

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = (entry: JournalEntry) => {
    const noteText = (entry.note.note_text || "").toLowerCase();
    const plant = (entry.note.plant_id || "").toLowerCase();
    return noteText.includes(trimmedQuery) || plant.includes(trimmedQuery);
  };

  const recentEntries = entries.filter((e) => isRecent(e.date));
  const olderEntries = entries.filter((e) => !isRecent(e.date));
  const searchResults = trimmedQuery ? entries.filter(matchesSearch) : [];

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
    await deleteNote(selectedEntry.note.note_id, idTokenCache, selectedEntry.note.photos ?? []);
    setFullscreenVisible(false);
    loadEntries();
  };

  const renderCard = ({ item }: { item: JournalEntry }) => (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={() => openEntry(item)}
      activeOpacity={0.85}
    >
      {item.photoUrls.length > 0 ? (
        <View>
          <Image
            source={{ uri: item.photoUrls[0] }}
            style={[styles.cardImage, { width: cardWidth, height: cardWidth }]}
            contentFit="cover"
          />
          {item.photoUrls.length > 1 && (
            <View style={styles.photoCountBadge}>
              <Ionicons name="images" size={10} color="#fff" />
              <Text style={styles.photoCountBadgeText}>{item.photoUrls.length}</Text>
            </View>
          )}
        </View>
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

  const renderRow = ({ item }: { item: JournalEntry }) => (
    <TouchableOpacity style={styles.tableRow} onPress={() => openEntry(item)} activeOpacity={0.7}>
      <Text style={styles.tableRowDate}>{item.date}</Text>
      <View style={styles.tableRowBody}>
        <Text style={styles.tableRowNote} numberOfLines={1}>
          {item.note.note_text || "No note text"}
        </Text>
        <View style={styles.tableRowTags}>
          {item.note.area_id && item.note.area_id !== " " && (
            <Text style={styles.tableRowTag}>{item.note.area_id}</Text>
          )}
          {item.note.plant_id && item.note.plant_id !== " " && (
            <Text style={styles.tableRowTag}>{item.note.plant_id}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#a2aca4" />
    </TouchableOpacity>
  );

  const renderEmptyList = (message: string) => (
    <View style={styles.listEmptyContainer}>
      <Text style={styles.emptySubtext}>{message}</Text>
    </View>
  );

  return (
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#656e5f" />
          </TouchableOpacity>
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

        {!loading && entries.length > 0 && (
          <>
            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#a2aca4" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search notes or plants…"
                placeholderTextColor="#a2aca4"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={16} color="#a2aca4" />
                </TouchableOpacity>
              )}
            </View>

            {!trimmedQuery && (
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleButton, viewMode === 'recent' && styles.toggleButtonActive]}
                  onPress={() => setViewMode('recent')}
                >
                  <Text style={[styles.toggleButtonText, viewMode === 'recent' && styles.toggleButtonTextActive]}>Recent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, viewMode === 'older' && styles.toggleButtonActive]}
                  onPress={() => setViewMode('older')}
                >
                  <Text style={[styles.toggleButtonText, viewMode === 'older' && styles.toggleButtonTextActive]}>Older</Text>
                </TouchableOpacity>
              </View>
            )}

            {trimmedQuery ? (
              <FlatList
                key="search-results"
                data={searchResults}
                keyExtractor={(item) => item.note.note_id}
                renderItem={renderRow}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={() => renderEmptyList("No entries match your search.")}
              />
            ) : viewMode === 'recent' ? (
              <FlatList
                key="recent-grid"
                data={recentEntries}
                keyExtractor={(item) => item.note.note_id}
                numColumns={numColumns}
                renderItem={renderCard}
                contentContainerStyle={styles.grid}
                columnWrapperStyle={styles.row}
                ListEmptyComponent={() => renderEmptyList("No entries from the last 7 days.")}
              />
            ) : (
              <FlatList
                key="older-list"
                data={olderEntries}
                keyExtractor={(item) => item.note.note_id}
                renderItem={renderRow}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={() => renderEmptyList("No older entries yet.")}
              />
            )}
          </>
        )}

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
              {selectedEntry && selectedEntry.photoUrls.length > 0 ? (
                <View>
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                    {selectedEntry.photoUrls.map((url, idx) => (
                      <Image
                        key={idx}
                        source={{ uri: url }}
                        style={[styles.fullscreenImage, { width: screenWidth }]}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                  {selectedEntry.photoUrls.length > 1 && (
                    <View style={styles.galleryCountBadge}>
                      <Ionicons name="images" size={12} color="#fff" />
                      <Text style={styles.galleryCountBadgeText}>{selectedEntry.photoUrls.length} photos — swipe to view</Text>
                    </View>
                  )}
                </View>
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
  backButtonHeader: {
    padding: 8,
    backgroundColor: "rgba(101,110,95,0.15)",
    borderRadius: 20,
    marginBottom: 4,
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

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#c4ccbd",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#323232",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    padding: 0,
  },

  // Recent / Older toggle
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(101,110,95,0.12)",
  },
  toggleButtonActive: {
    backgroundColor: "#5a8a5e",
  },
  toggleButtonText: {
    color: "#656e5f",
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
  },
  toggleButtonTextActive: {
    color: "#fff",
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

  // Text-only list (Older / Search results)
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  listEmptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(101,110,95,0.15)",
  },
  tableRowDate: {
    width: 68,
    color: "#656e5f",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 0.3,
  },
  tableRowBody: {
    flex: 1,
    gap: 4,
  },
  tableRowNote: {
    color: "#323232",
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
  },
  tableRowTags: {
    flexDirection: "row",
    gap: 6,
  },
  tableRowTag: {
    color: "#514942",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    backgroundColor: "rgba(81,73,66,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
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
  photoCountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(50,50,50,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  photoCountBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
  },
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
  galleryCountBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(50,50,50,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  galleryCountBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
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