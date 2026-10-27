import { Ionicons } from '@expo/vector-icons';
import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import { fetchAuthSession } from "aws-amplify/auth";
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { getResolvedUsername } from "../login/authUser";

const AREAS_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/areas";
const PLANTS_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/plants";
const PROFILE_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/profile";

const GROWING_PHASES = ["Not Started", "Seed Starting", "Transplanting", "Growing", "Harvest", "Purchased", "Failed", "Completed"];
const SEASONS = ["Spring", "Summer", "Fall", "Winter"];

// Fields copied from the master plant record when a species is picked — matches
// the same field list SAGE's web app (plants-areas.jsx updateSpecies) copies.
const MASTER_PLANT_FIELDS = [
  "daysToTransplant", "daysToHarvest", "germinationTime", "minimumTemp", "maximumTemp",
  "yield_per_plant_ounces", "plant_family", "season", "size", "foodForestLayer",
  "guildFunction", "climate", "USDAMin", "USDAMax", "spacing_between_plants",
];

// Simple (non-cryptographic) UUID v4 — good enough for a client-generated record id.
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Area = { id: string; name: string; year: number; plants?: any[]; info?: any; history?: any };
type MasterPlant = { name: string; [key: string]: any };
type PickerKind = "area" | "species" | "phase" | "season" | null;

export default function AddAreaPlantScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const [mode, setMode] = useState<"area" | "plant">("area");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [areas, setAreas] = useState<Area[]>([]);
  const [masterPlants, setMasterPlants] = useState<MasterPlant[]>([]);
  const [unitMeasurement, setUnitMeasurement] = useState<"imperial" | "metric">("imperial");

  // Add Area fields
  const [areaName, setAreaName] = useState("");
  const [totalSpace, setTotalSpace] = useState("");

  // Add Plant fields
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [species, setSpecies] = useState("");
  const [variety, setVariety] = useState("");
  const [numPlants, setNumPlants] = useState("");
  const [growingPhase, setGrowingPhase] = useState("");
  const [seasonRotation, setSeasonRotation] = useState("");

  const [pickerFor, setPickerFor] = useState<PickerKind>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  useEffect(() => {
    (async () => {
      const username = await getResolvedUsername();
      setUserName(username);
    })();
  }, []);

  useEffect(() => {
    if (userName) {
      loadData();
      loadProfile();
    }
  }, [userName]);

  async function authHeaders(extra = {}) {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    return { Authorization: idToken, username: userName, ...extra };
  }

  async function loadProfile() {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${PROFILE_URL}?username=${encodeURIComponent(userName)}`, { method: "GET", headers });
      const raw = await response.json();
      if (!response.ok) { console.error("GET /profile failed:", response.status, raw); return; }
      const profile = Array.isArray(raw) ? raw[0] : raw;
      setUnitMeasurement(profile?.unitmeasurement === "metric" ? "metric" : "imperial");
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [areasRes, plantsRes] = await Promise.all([
        fetch(AREAS_URL, { method: "GET", headers }),
        fetch(PLANTS_URL, { method: "GET", headers }),
      ]);
      const areasData = await areasRes.json();
      const plantsData = await plantsRes.json();
      setAreas(Array.isArray(areasData) ? areasData : []);
      setMasterPlants(Array.isArray(plantsData) ? plantsData : []);
    } catch (err) {
      console.error("Error loading areas/plants:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetPlantForm() {
    setSelectedArea(null);
    setSpecies("");
    setVariety("");
    setNumPlants("");
    setGrowingPhase("");
    setSeasonRotation("");
  }

  async function submitArea() {
    if (!areaName.trim()) { alert("Please enter an area name"); return; }
    if (!totalSpace.trim()) { alert("Please enter the total space"); return; }

    setSaving(true);
    try {
      const headers = await authHeaders({ "Content-Type": "application/json" });
      const newArea = {
        id: uuidv4(),
        name: areaName.trim(),
        year: new Date().getFullYear(),
        info: { totalSpace },
        history: {},
        plants: [],
        username: userName,
      };
      const response = await fetch(AREAS_URL, { method: "POST", headers, body: JSON.stringify(newArea) });
      if (!response.ok) throw new Error(`POST /areas failed: ${response.status}`);

      setAreaName("");
      setTotalSpace("");
      setSuccessMsg("Area added!");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadData();
    } catch (err) {
      console.error("Error adding area:", err);
      alert("Failed to add area");
    } finally {
      setSaving(false);
    }
  }

  async function submitPlant() {
    if (!selectedArea) { alert("Please select an area"); return; }
    if (!species) { alert("Please select a species"); return; }
    if (!numPlants.trim()) { alert("Please enter the number of plants"); return; }
    if (!growingPhase) { alert("Please select a growing phase"); return; }

    setSaving(true);
    try {
      const master = masterPlants.find(p => p.name === species) || {};
      const plant: any = { id: uuidv4(), species, variety, numPlants, status: growingPhase, season_rotation: seasonRotation, harvests: [], notes: [], harvestTotals: 0, totalHarvest: 0 };
      MASTER_PLANT_FIELDS.forEach((key) => { if (master[key] !== undefined) plant[key] = master[key]; });

      const spacing = parseFloat(plant.spacing_between_plants) || 1;
      const numPerSqFt = Math.pow(12 / spacing, 2);
      plant.spaceUsed = (parseFloat(numPlants) / numPerSqFt).toFixed(2);
      plant.estHarvest = plant.yield_per_plant_ounces ? (plant.yield_per_plant_ounces * parseFloat(numPlants)) / 16.0 : 0;

      const headers = await authHeaders({ "Content-Type": "application/json" });
      const updatedArea = { ...selectedArea, plants: [...(selectedArea.plants || []), plant] };
      const response = await fetch(AREAS_URL, { method: "PUT", headers, body: JSON.stringify(updatedArea) });
      if (!response.ok) throw new Error(`PUT /areas failed: ${response.status}`);

      resetPlantForm();
      setSuccessMsg("Plant added!");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadData();
    } catch (err) {
      console.error("Error adding plant:", err);
      alert("Failed to add plant");
    } finally {
      setSaving(false);
    }
  }

  const allPickerOptions = (() => {
    if (pickerFor === "area") return areas.map(a => ({ key: a.id, label: `${a.name} (${a.year})` }));
    if (pickerFor === "species") return masterPlants.map(p => ({ key: p.name, label: p.name })).sort((a, b) => a.label.localeCompare(b.label));
    if (pickerFor === "phase") return GROWING_PHASES.map(p => ({ key: p, label: p }));
    if (pickerFor === "season") return SEASONS.map(s => ({ key: s, label: s }));
    return [];
  })();

  const pickerOptions = pickerSearch.trim()
    ? allPickerOptions.filter(o => o.label.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
    : allPickerOptions;

  function openPicker(kind: PickerKind) {
    setPickerSearch("");
    setPickerFor(kind);
  }

  function selectPickerOption(key: string) {
    if (pickerFor === "area") setSelectedArea(areas.find(a => a.id === key) || null);
    if (pickerFor === "species") setSpecies(key);
    if (pickerFor === "phase") setGrowingPhase(key);
    if (pickerFor === "season") setSeasonRotation(key);
    setPickerFor(null);
  }

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#656e5f" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerEyebrow}>YOUR GARDEN</Text>
          <Text style={styles.headerTitle}>Add to Garden</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.headerDivider} />

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "area" && styles.modeButtonActive]}
          onPress={() => setMode("area")}
        >
          <Text style={[styles.modeButtonText, mode === "area" && styles.modeButtonTextActive]}>Add Area</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === "plant" && styles.modeButtonActive]}
          onPress={() => setMode("plant")}
        >
          <Text style={[styles.modeButtonText, mode === "plant" && styles.modeButtonTextActive]}>Add Plant</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#81c784" size="large" />
          <Text style={styles.loadingText}>Loading your garden…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {mode === "area" ? (
              <>
                <Text style={styles.fieldLabel}>AREA NAME</Text>
                <TextInput
                  style={styles.input}
                  value={areaName}
                  onChangeText={setAreaName}
                  placeholder="e.g. Back Garden Bed"
                  placeholderTextColor="#a2aca4"
                />

                <Text style={styles.fieldLabel}>TOTAL SPACE ({unitMeasurement === "metric" ? "SQ M" : "SQ FT"})</Text>
                <TextInput
                  style={styles.input}
                  value={totalSpace}
                  onChangeText={setTotalSpace}
                  placeholder="e.g. 48"
                  placeholderTextColor="#a2aca4"
                  keyboardType="decimal-pad"
                />

                {successMsg ? <Text style={styles.successMsg}>{successMsg}</Text> : null}

                <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={submitArea} disabled={saving}>
                  {saving ? <ActivityIndicator color="#d0d7cc" size="small" /> : (
                    <>
                      <Text style={styles.saveButtonText}>Add Area</Text>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#d0d7cc" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>AREA</Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openPicker("area")} disabled={areas.length === 0}>
                  <Text style={selectedArea ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                    {selectedArea ? `${selectedArea.name} (${selectedArea.year})` : "Select an area"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#a2aca4" />
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>SPECIES</Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openPicker("species")} disabled={masterPlants.length === 0}>
                  <Text style={species ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                    {species || "Select a species"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#a2aca4" />
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>VARIETY</Text>
                <TextInput
                  style={styles.input}
                  value={variety}
                  onChangeText={setVariety}
                  placeholderTextColor="#a2aca4"
                />

                <Text style={styles.fieldLabel}>NUMBER OF PLANTS</Text>
                <TextInput
                  style={styles.input}
                  value={numPlants}
                  onChangeText={setNumPlants}
                  placeholderTextColor="#a2aca4"
                  keyboardType="number-pad"
                />

                <Text style={styles.fieldLabel}>GROWING PHASE</Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openPicker("phase")}>
                  <Text style={growingPhase ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                    {growingPhase || "Select a growing phase"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#a2aca4" />
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>SEASON <Text style={styles.optionalTag}>(optional)</Text></Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openPicker("season")}>
                  <Text style={seasonRotation ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                    {seasonRotation || "Select a season"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#a2aca4" />
                </TouchableOpacity>

                {successMsg ? <Text style={styles.successMsg}>{successMsg}</Text> : null}

                <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={submitPlant} disabled={saving}>
                  {saving ? <ActivityIndicator color="#d0d7cc" size="small" /> : (
                    <>
                      <Text style={styles.saveButtonText}>Add Plant</Text>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#d0d7cc" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Generic picker modal */}
      <Modal animationType="slide" transparent visible={pickerFor !== null} onRequestClose={() => setPickerFor(null)}>
        <TouchableWithoutFeedback onPress={() => setPickerFor(null)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerSheetTitle}>
            {pickerFor === "area" ? "Select an area" : pickerFor === "species" ? "Select a species" : pickerFor === "phase" ? "Select a growing phase" : "Select a season"}
          </Text>
          {pickerFor === "species" && (
            <TextInput
              style={styles.pickerSearchInput}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Search species…"
              placeholderTextColor="#a2aca4"
              autoCorrect={false}
            />
          )}
          <FlatList
            data={pickerOptions}
            keyExtractor={(item) => item.key}
            style={styles.pickerList}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerOption} onPress={() => selectPickerOption(item.key)}>
                <Text style={styles.pickerOptionText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => <Text style={styles.pickerEmptyText}>Nothing to pick from yet.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#d0d7c9" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 30,
    paddingBottom: 14,
    paddingHorizontal: 24,
    backgroundColor: "#d0d7c9",
  },
  headerEyebrow: { color: "#81c784", fontSize: 10, fontFamily: "Poppins_600SemiBold", letterSpacing: 3, marginBottom: 2 },
  headerTitle: { fontSize: 32, fontFamily: "Poppins_400Regular", color: "#323232", letterSpacing: -0.5 },
  headerDivider: { height: 1, backgroundColor: "#656e5f", opacity: 0.25, marginHorizontal: 24, marginBottom: 12 },
  backButtonHeader: { padding: 8, backgroundColor: "rgba(101,110,95,0.15)", borderRadius: 20, marginBottom: 4 },

  modeRow: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 16, gap: 10 },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8d0c4",
    backgroundColor: "#eaede7",
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: "#514942", borderColor: "#514942" },
  modeButtonText: { color: "#656e5f", fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  modeButtonTextActive: { color: "#d0d7cc" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#656e5f", fontFamily: "Poppins_400Regular", fontSize: 14 },

  form: { paddingHorizontal: 24, paddingBottom: 48 },
  fieldLabel: { color: "#5a8a5e", fontSize: 10, fontFamily: "Poppins_600SemiBold", letterSpacing: 2, marginBottom: 8, marginTop: 4 },
  optionalTag: { color: "#a2aca4", fontFamily: "Poppins_400Regular", letterSpacing: 1 },
  input: {
    width: '100%',
    minHeight: 48,
    borderColor: '#c8d0c4',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    color: '#323232',
    backgroundColor: '#ffffff',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8d0c4',
    backgroundColor: '#ffffff',
    marginBottom: 14,
  },
  selectText: { color: '#323232', fontSize: 14, fontFamily: 'Poppins_400Regular', flex: 1 },
  selectPlaceholder: { color: '#a2aca4', fontSize: 14, fontFamily: 'Poppins_400Regular', flex: 1 },

  successMsg: { color: "#5a8a5e", fontFamily: "Poppins_600SemiBold", fontSize: 13, marginBottom: 12, textAlign: "center" },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#514942',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#d0d7cc', fontFamily: 'Poppins_700Bold', fontSize: 14, letterSpacing: 0.5 },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    backgroundColor: '#f5f7f3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  pickerSheetTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#323232', marginBottom: 12 },
  pickerSearchInput: {
    minHeight: 44,
    borderColor: '#c8d0c4',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    color: '#323232',
    backgroundColor: '#ffffff',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  pickerList: { marginBottom: 12 },
  pickerOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e6de' },
  pickerOptionText: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: '#323232' },
  pickerEmptyText: { color: '#a2aca4', fontFamily: 'Poppins_400Regular', fontSize: 14, paddingVertical: 20, textAlign: 'center' },
});
