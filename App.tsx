import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import elementsData from './src/config/elements.json';
import recipesData from './src/config/recipes.json';
import { ElementItem, ActiveCanvasElement, RecipeDictionary } from './src/types/game';
import { combineElements, checkCollision, getMidpoint } from './src/utils/gameLogic';

const STORAGE_KEYS = {
  DISCOVERED: '@elemental_discovered',
  CANVAS: '@elemental_canvas',
};

const DEFAULT_STARTING_ELEMENTS = [
  'earth', 'air', 'fire', 'water', 'sand', 'lightning', 'ice', 'metal', 'wood'
];

// Helper: Custom SVG Icon Renderer
const ElementIcon = ({ path, color, size = 32 }: { path: string; color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={path} fill={color} />
  </Svg>
);

// Sub-component: Draggable Canvas Item using PanResponder
interface DraggableCanvasItemProps {
  element: ActiveCanvasElement;
  item: ElementItem;
  onDragStart: (instanceId: string, x: number, y: number) => void;
  onDragMove: (instanceId: string, dx: number, dy: number) => void;
  onDragRelease: (instanceId: string, endX: number, endY: number) => void;
}

const DraggableCanvasItem = ({
  element,
  item,
  onDragStart,
  onDragMove,
  onDragRelease,
}: DraggableCanvasItemProps) => {
  const lastPosition = useRef({ x: element.x, y: element.y });

  // Update position reference when element prop changes
  useEffect(() => {
    lastPosition.current = { x: element.x, y: element.y };
  }, [element.x, element.y]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onDragStart(element.instanceId, lastPosition.current.x, lastPosition.current.y);
      },
      onPanResponderMove: (evt, gestureState) => {
        onDragMove(element.instanceId, gestureState.dx, gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const endX = lastPosition.current.x + gestureState.dx;
        const endY = lastPosition.current.y + gestureState.dy;
        onDragRelease(element.instanceId, endX, endY);
      },
    })
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.canvasElement,
        {
          left: element.x,
          top: element.y,
          borderColor: item.color,
          shadowColor: item.color,
        },
        item.isFinal && styles.finalStateGlow,
      ]}
    >
      <ElementIcon path={item.svgPath} color={item.color} size={28} />
      <Text style={styles.canvasElementText} numberOfLines={1}>
        {item.name}
      </Text>
    </View>
  );
};

export default function App() {
  const elements = elementsData as ElementItem[];
  const recipes = recipesData as RecipeDictionary;

  // Game States
  const [discoveredIds, setDiscoveredIds] = useState<string[]>(DEFAULT_STARTING_ELEMENTS);
  const [canvasElements, setCanvasElements] = useState<ActiveCanvasElement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'basic' | 'combined' | 'final'>('all');
  
  // Highlight Discovery Modal State
  const [discoveredElement, setDiscoveredElement] = useState<ElementItem | null>(null);

  // Keep track of canvas sizing for containment checks
  const [canvasLayout, setCanvasLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // References to track drag offset starts
  const dragStartPositions = useRef<{ [key: string]: { x: number; y: number } }>({});

  // 1. Initial State Loading from Storage
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const storedDiscovered = await AsyncStorage.getItem(STORAGE_KEYS.DISCOVERED);
        const storedCanvas = await AsyncStorage.getItem(STORAGE_KEYS.CANVAS);
        
        if (storedDiscovered) {
          setDiscoveredIds(JSON.parse(storedDiscovered));
        } else {
          // Setup defaults
          await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(DEFAULT_STARTING_ELEMENTS));
        }
        
        if (storedCanvas) {
          setCanvasElements(JSON.parse(storedCanvas));
        }
      } catch (e) {
        console.error('Failed to load storage state', e);
      }
    };
    loadSavedState();
  }, []);

  // Helper to update state and trigger asynchronous save
  const saveState = async (newDiscovered: string[], newCanvas: ActiveCanvasElement[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(newDiscovered));
      await AsyncStorage.setItem(STORAGE_KEYS.CANVAS, JSON.stringify(newCanvas));
    } catch (e) {
      console.error('Failed to save state to storage', e);
    }
  };

  // 2. Click Handler: Spawn New Item from Sidebar onto Canvas
  const handleSpawnElement = (elementId: string) => {
    // Generate placement coordinates (near the center with a slight random jitter)
    const centerX = canvasLayout.width > 0 ? (canvasLayout.width / 2) - 40 : 100;
    const centerY = canvasLayout.height > 0 ? (canvasLayout.height / 2) - 40 : 150;
    
    const jitterX = Math.round((Math.random() - 0.5) * 40);
    const jitterY = Math.round((Math.random() - 0.5) * 40);

    const newInstance: ActiveCanvasElement = {
      instanceId: `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      elementId,
      x: Math.max(10, centerX + jitterX),
      y: Math.max(10, centerY + jitterY),
    };

    const updatedCanvas = [...canvasElements, newInstance];
    setCanvasElements(updatedCanvas);
    saveState(discoveredIds, updatedCanvas);
  };

  // 3. Clear & Reset Actions
  const handleClearCanvas = () => {
    setCanvasElements([]);
    saveState(discoveredIds, []);
  };

  const handleResetGame = async () => {
    setDiscoveredIds(DEFAULT_STARTING_ELEMENTS);
    setCanvasElements([]);
    await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(DEFAULT_STARTING_ELEMENTS));
    await AsyncStorage.setItem(STORAGE_KEYS.CANVAS, JSON.stringify([]));
  };

  // 4. Drag & Drop Gestures Handlers
  const handleDragStart = (instanceId: string, x: number, y: number) => {
    dragStartPositions.current[instanceId] = { x, y };
  };

  const handleDragMove = (instanceId: string, dx: number, dy: number) => {
    const startPos = dragStartPositions.current[instanceId];
    if (!startPos) return;

    setCanvasElements(prev =>
      prev.map(el => {
        if (el.instanceId === instanceId) {
          return {
            ...el,
            x: startPos.x + dx,
            y: startPos.y + dy,
          };
        }
        return el;
      })
    );
  };

  const handleDragRelease = (instanceId: string, endX: number, endY: number) => {
    delete dragStartPositions.current[instanceId];

    setCanvasElements(currentCanvas => {
      const dragged = currentCanvas.find(el => el.instanceId === instanceId);
      if (!dragged) return currentCanvas;

      // Define coordinates for Trash Can (bottom left: padding=20, size=60)
      const trashCenterX = 20 + 30;
      const trashCenterY = canvasLayout.height - 20 - 30;
      const distToTrash = Math.sqrt(
        Math.pow((endX + 40) - trashCenterX, 2) + Math.pow((endY + 40) - trashCenterY, 2)
      );

      // Check if dropped out of canvas bounds
      const isOutOfBounds =
        endX < -40 ||
        endY < -40 ||
        endX > canvasLayout.width - 40 ||
        endY > canvasLayout.height - 40;

      // If dragged to trash or off canvas, delete it
      if (distToTrash <= 50 || isOutOfBounds) {
        const remaining = currentCanvas.filter(el => el.instanceId !== instanceId);
        saveState(discoveredIds, remaining);
        return remaining;
      }

      // Update position of the dragged item
      let updatedCanvas = currentCanvas.map(el =>
        el.instanceId === instanceId ? { ...el, x: endX, y: endY } : el
      );

      let combined = false;

      // Find collisions with other elements
      for (const other of currentCanvas) {
        if (other.instanceId === instanceId) continue;

        const c1x = endX + 40;
        const c1y = endY + 40;
        const c2x = other.x + 40;
        const c2y = other.y + 40;

        // Collision threshold matching visual boundaries (55 pixels)
        if (checkCollision(c1x, c1y, c2x, c2y, 55)) {
          const product = combineElements(dragged.elementId, other.elementId, recipes);
          if (product) {
            const midpoint = getMidpoint(endX, endY, other.x, other.y);

            // Consume ingredient elements
            updatedCanvas = updatedCanvas.filter(
              el => el.instanceId !== instanceId && el.instanceId !== other.instanceId
            );

            // Add newly combined product
            const combinedInstance: ActiveCanvasElement = {
              instanceId: `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              elementId: product,
              x: midpoint.x,
              y: midpoint.y,
            };
            updatedCanvas.push(combinedInstance);

            // Discover element unlock logic
            setDiscoveredIds(currentDiscovered => {
              let updatedDiscovered = [...currentDiscovered];
              if (!currentDiscovered.includes(product)) {
                updatedDiscovered.push(product);
                // Trigger overlay modal
                const itemDetails = elements.find(el => el.id === product);
                if (itemDetails) {
                  setDiscoveredElement(itemDetails);
                }
              }
              saveState(updatedDiscovered, updatedCanvas);
              return updatedDiscovered;
            });

            combined = true;
            break;
          }
        }
      }

      if (!combined) {
        saveState(discoveredIds, updatedCanvas);
      }

      return updatedCanvas;
    });
  };

  // 5. Filter Discovered Sidebar Lists
  const discoveredElements = elements.filter(el => discoveredIds.includes(el.id));
  
  const filteredElements = discoveredElements.filter(el => {
    const matchesSearch = el.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'basic') return el.category === 'basic';
    if (activeTab === 'final') return el.isFinal;
    if (activeTab === 'combined') return el.category !== 'basic' && !el.isFinal;
    return true;
  });

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    setCanvasLayout(event.nativeEvent.layout);
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar style="light" />
      
      {/* Header Panel */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Elemental Combinations</Text>
          <Text style={styles.subtitle}>
            Discovered: {discoveredIds.length} / {elements.length}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={[styles.glassButton, styles.resetButton]} onPress={handleResetGame}>
            <Text style={styles.resetButtonText}>Reset Game</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, styles.clearButton]} onPress={handleClearCanvas}>
            <Text style={styles.clearButtonText}>Clear Board</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Split Screen */}
      <View style={styles.mainLayout}>
        
        {/* Workspace Canvas (Left Area) */}
        <View style={styles.canvasContainer} onLayout={onCanvasLayout}>
          {canvasElements.length === 0 ? (
            <View style={styles.emptyCanvasHint}>
              <Text style={styles.hintText}>WORKSPACE CANVAS</Text>
              <Text style={styles.subHintText}>
                Tap items in the right sidebar to spawn them. Drag and drop them onto each other to combine!
              </Text>
            </View>
          ) : (
            canvasElements.map(el => {
              const item = elements.find(item => item.id === el.elementId);
              if (!item) return null;
              return (
                <DraggableCanvasItem
                  key={el.instanceId}
                  element={el}
                  item={item}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragRelease={handleDragRelease}
                />
              );
            })
          )}

          {/* Glowing Red Trash Bin in bottom-left corner */}
          {canvasLayout.height > 0 && (
            <View style={styles.trashBinContainer}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path 
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" 
                  fill="#EF5350" 
                />
              </Svg>
            </View>
          )}
        </View>

        {/* Right-hand Sidebar (Discovery Inventory) */}
        <View style={styles.sidebar}>
          <TextInput
            style={styles.searchBar}
            placeholder="Search discovered..."
            placeholderTextColor="#607D8B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Filtering Categories */}
          <View style={styles.tabContainer}>
            {(['all', 'basic', 'combined', 'final'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Scrollable grid listing discovered elements */}
          <ScrollView 
            contentContainerStyle={styles.sidebarGrid}
            showsVerticalScrollIndicator={false}
          >
            {filteredElements.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={[
                  styles.sidebarCard, 
                  item.isFinal && styles.finalSidebarCard
                ]}
                activeOpacity={0.7}
                onPress={() => handleSpawnElement(item.id)}
              >
                <View style={[styles.iconWrapper, { backgroundColor: `${item.color}15` }]}>
                  <ElementIcon path={item.svgPath} color={item.color} size={22} />
                </View>
                <Text style={styles.sidebarCardText} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.isFinal && <Text style={styles.finalBadge}>Final</Text>}
              </TouchableOpacity>
            ))}
            {filteredElements.length === 0 && (
              <Text style={styles.noItemsText}>No items found</Text>
            )}
          </ScrollView>
        </View>

      </View>

      {/* Popover Celebration Modal for Discovered Items */}
      {discoveredElement && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: discoveredElement.color }]}>
            <Text style={styles.modalHeader}>NEW DISCOVERY!</Text>
            
            <View style={[styles.modalIconWrapper, { backgroundColor: `${discoveredElement.color}15`, shadowColor: discoveredElement.color }]}>
              <ElementIcon path={discoveredElement.svgPath} color={discoveredElement.color} size={56} />
            </View>

            <Text style={[styles.modalTitle, { color: discoveredElement.color }]}>
              {discoveredElement.name}
            </Text>
            
            <Text style={styles.modalDescription}>
              {discoveredElement.description}
            </Text>

            <TouchableOpacity 
              style={[styles.modalButton, { borderColor: discoveredElement.color }]} 
              onPress={() => setDiscoveredElement(null)}
            >
              <Text style={[styles.modalButtonText, { color: discoveredElement.color }]}>
                Awesome!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2332',
    backgroundColor: '#0B0E14',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ECEFF1',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#80DEEA',
    marginTop: 2,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  glassButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  resetButton: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  resetButtonText: {
    color: '#90A4AE',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    borderColor: 'rgba(239, 83, 80, 0.4)',
    backgroundColor: 'rgba(239, 83, 80, 0.05)',
  },
  clearButtonText: {
    color: '#EF5350',
    fontSize: 12,
    fontWeight: '600',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  // Canvas Styles
  canvasContainer: {
    flex: 1.7,
    backgroundColor: '#0E131F',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyCanvasHint: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '40%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    color: '#1F2C46',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  subHintText: {
    color: '#4B5B75',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  canvasElement: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#121926',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    // iOS shadow glow effect
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 5,
  },
  finalStateGlow: {
    borderColor: '#FFD54F',
    shadowColor: '#FFD54F',
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  canvasElementText: {
    color: '#ECEFF1',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  trashBinContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 83, 80, 0.4)',
    backgroundColor: 'rgba(239, 83, 80, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF5350',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  // Sidebar Styles
  sidebar: {
    flex: 1,
    backgroundColor: '#111726',
    borderLeftWidth: 1,
    borderLeftColor: '#1A2332',
    padding: 8,
  },
  searchBar: {
    height: 38,
    backgroundColor: '#0A0E1A',
    borderColor: '#1F2C46',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#ECEFF1',
    fontSize: 12,
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 10,
  },
  tabButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2C46',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  tabButtonActive: {
    borderColor: '#80DEEA',
    backgroundColor: 'rgba(128,222,234,0.08)',
  },
  tabButtonText: {
    color: '#78909C',
    fontSize: 9,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#80DEEA',
  },
  sidebarGrid: {
    flexDirection: 'column',
    gap: 6,
    paddingBottom: 20,
  },
  sidebarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 6,
  },
  finalSidebarCard: {
    borderColor: 'rgba(255,213,79,0.3)',
    backgroundColor: 'rgba(255,213,79,0.03)',
  },
  iconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarCardText: {
    color: '#CFD8DC',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  finalBadge: {
    fontSize: 8,
    color: '#FFD54F',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,213,79,0.15)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  noItemsText: {
    color: '#607D8B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 7, 12, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 999,
  },
  modalContent: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#111726',
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD54F',
    letterSpacing: 2,
    marginBottom: 16,
  },
  modalIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 12,
    color: '#90A4AE',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
