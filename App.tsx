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
  Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import elementsData from './src/config/elements.json';
import recipesData from './src/config/recipes.json';
import translationsData from './src/config/translations.json';
import { ElementItem, ActiveCanvasElement, RecipeDictionary, ActiveCombinationAnimation } from './src/types/game';
import { combineElements, checkCollision, getMidpoint, calculateMagnetPosition } from './src/utils/gameLogic';
import { CombinationEffect } from './src/components/CombinationEffect';
import { playCombinationSound } from './src/utils/audio';

const STORAGE_KEYS = {
  DISCOVERED: '@elemental_discovered',
  CANVAS: '@elemental_canvas',
  LANGUAGE: '@elemental_language',
};

const DEFAULT_STARTING_ELEMENTS = [
  'earth', 'air', 'fire', 'water', 'sand', 'lightning', 'ice', 'metal', 'wood', 'plastic'
];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hu', label: 'Magyar', flag: '🇭🇺' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'la', label: 'Latina', flag: '🏛️' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
] as const;

type Language = typeof LANGUAGES[number]['code'];

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
  name: string; // pre-translated name
  onDragStart: (instanceId: string, x: number, y: number) => void;
  onDragMove: (instanceId: string, dx: number, dy: number) => void;
  onDragRelease: (instanceId: string, endX: number, endY: number) => void;
}

const DraggableCanvasItem = ({
  element,
  item,
  name,
  onDragStart,
  onDragMove,
  onDragRelease,
}: DraggableCanvasItemProps) => {
  const lastPosition = useRef({ x: element.x, y: element.y });
  const spawnScale = useRef(new Animated.Value(element.isNew ? 0 : 1)).current;

  // Update position reference when element prop changes
  useEffect(() => {
    lastPosition.current = { x: element.x, y: element.y };
  }, [element.x, element.y]);

  useEffect(() => {
    if (element.isNew) {
      const timer = setTimeout(() => {
        Animated.spring(spawnScale, {
          toValue: 1,
          friction: 4.5,
          tension: 90,
          useNativeDriver: false,
        }).start();
      }, 170);
      return () => clearTimeout(timer);
    }
  }, [element.isNew]);

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
        onDragRelease(element.instanceId, lastPosition.current.x, lastPosition.current.y);
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.canvasElement,
        {
          left: element.x,
          top: element.y,
          borderColor: item.color,
          shadowColor: item.color,
          transform: [{ scale: spawnScale }],
        },
        item.isFinal && styles.finalStateGlow,
      ]}
    >
      <ElementIcon path={item.svgPath} color={item.color} size={28} />
      <Text style={styles.canvasElementText} numberOfLines={1}>
        {name}
      </Text>
    </Animated.View>
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
  
  // Localization States
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [showLangMenu, setShowLangMenu] = useState(false);
  
  // Proximity Vector Line state connecting snapping pairs
  const [proximityLine, setProximityLine] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string } | null>(null);

  // Active combination animation effects playing on canvas
  const [activeCombinations, setActiveCombinations] = useState<ActiveCombinationAnimation[]>([]);

  // Highlight Discovery Modal State
  const [discoveredElement, setDiscoveredElement] = useState<ElementItem | null>(null);

  // Keep track of canvas sizing for containment checks
  const [canvasLayout, setCanvasLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // References to track drag offset starts
  const dragStartPositions = useRef<{ [key: string]: { x: number; y: number } }>({});

  // Translation helpers
  const t = (key: keyof typeof translationsData.ui) => {
    return translationsData.ui[key][currentLanguage] || translationsData.ui[key]['en'];
  };

  const getElementTranslation = (id: string) => {
    const defaultElement = elements.find(el => el.id === id);
    if (!defaultElement) return { name: id, description: '' };

    const translation = (translationsData.elements as any)[id];
    if (translation) {
      return {
        name: translation.name[currentLanguage] || defaultElement.name,
        description: translation.description[currentLanguage] || defaultElement.description,
      };
    }
    return { name: defaultElement.name, description: defaultElement.description };
  };

  // 1. Initial State Loading from Storage
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const storedDiscovered = await AsyncStorage.getItem(STORAGE_KEYS.DISCOVERED);
        const storedCanvas = await AsyncStorage.getItem(STORAGE_KEYS.CANVAS);
        const storedLang = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
        
        if (storedDiscovered) {
          setDiscoveredIds(JSON.parse(storedDiscovered));
        } else {
          // Setup defaults
          await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(DEFAULT_STARTING_ELEMENTS));
        }
        
        if (storedCanvas) {
          setCanvasElements(JSON.parse(storedCanvas));
        }

        if (storedLang) {
          setCurrentLanguage(storedLang as Language);
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

  // 3. Clear, Reset, & Language Actions
  const handleClearCanvas = () => {
    setCanvasElements([]);
    setProximityLine(null);
    setActiveCombinations([]);
    saveState(discoveredIds, []);
  };

  const handleResetGame = async () => {
    setDiscoveredIds(DEFAULT_STARTING_ELEMENTS);
    setCanvasElements([]);
    setProximityLine(null);
    setActiveCombinations([]);
    await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(DEFAULT_STARTING_ELEMENTS));
    await AsyncStorage.setItem(STORAGE_KEYS.CANVAS, JSON.stringify([]));
  };

  const handleCombinationComplete = (animId: string) => {
    setActiveCombinations(prev => prev.filter(anim => anim.id !== animId));
  };

  const handleSelectLanguage = async (lang: Language) => {
    setCurrentLanguage(lang);
    setShowLangMenu(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    } catch (e) {
      console.error('Failed to save language setting', e);
    }
  };

  // 4. Drag & Drop Gestures Handlers
  const handleDragStart = (instanceId: string, x: number, y: number) => {
    dragStartPositions.current[instanceId] = { x, y };
  };

  const handleDragMove = (instanceId: string, dx: number, dy: number) => {
    const startPos = dragStartPositions.current[instanceId];
    if (!startPos) return;

    const rawX = startPos.x + dx;
    const rawY = startPos.y + dy;

    // Default positioning coordinates
    let finalX = rawX;
    let finalY = rawY;
    let activeProximity: typeof proximityLine = null;

    const currentDragged = canvasElements.find(el => el.instanceId === instanceId);
    
    if (currentDragged) {
      let closestPartner: ActiveCanvasElement | null = null;
      let closestDist = Infinity;

      // Find closest compatible item on canvas
      for (const other of canvasElements) {
        if (other.instanceId === instanceId) continue;

        // Check if combination is possible
        const canCombine = combineElements(currentDragged.elementId, other.elementId, recipes);
        if (canCombine) {
          const c1x = rawX + 40;
          const c1y = rawY + 40;
          const c2x = other.x + 40;
          const c2y = other.y + 40;
          const distance = Math.sqrt(Math.pow(c2x - c1x, 2) + Math.pow(c2y - c1y, 2));

          if (distance < closestDist) {
            closestDist = distance;
            closestPartner = other;
          }
        }
      }

      // Snapping & Proximity Indicators
      if (closestPartner) {
        const partnerItem = elements.find(el => el.id === closestPartner!.elementId);
        
        // 1. Proximity Check: below 95px distance shows dashed connector lines
        if (closestDist <= 95 && partnerItem) {
          activeProximity = {
            x1: rawX + 40,
            y1: rawY + 40,
            x2: closestPartner.x + 40,
            y2: closestPartner.y + 40,
            color: partnerItem.color,
          };

          // 2. Magnetic Snap: below 70px triggers physical snapping coordinates pull
          if (closestDist <= 70) {
            const magnet = calculateMagnetPosition(rawX, rawY, closestPartner.x, closestPartner.y, 70, 0.45);
            finalX = magnet.x;
            finalY = magnet.y;
            
            // Adjust proximity line to align with magnetic coordinates
            activeProximity.x1 = finalX + 40;
            activeProximity.y1 = finalY + 40;
          }
        }
      }
    }

    setProximityLine(activeProximity);

    setCanvasElements(prev =>
      prev.map(el => {
        if (el.instanceId === instanceId) {
          return {
            ...el,
            x: finalX,
            y: finalY,
          };
        }
        return el;
      })
    );
  };

  const handleDragRelease = (instanceId: string, endX: number, endY: number) => {
    delete dragStartPositions.current[instanceId];
    setProximityLine(null);

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

      // Update final position
      let updatedCanvas = currentCanvas.map(el =>
        el.instanceId === instanceId ? { ...el, x: endX, y: endY } : el
      );

      let combined = false;

      // Find collisions with other elements. Threshold raised to 75px for magnetic comfort.
      for (const other of currentCanvas) {
        if (other.instanceId === instanceId) continue;

        const c1x = endX + 40;
        const c1y = endY + 40;
        const c2x = other.x + 40;
        const c2y = other.y + 40;

        if (checkCollision(c1x, c1y, c2x, c2y, 75)) {
          const product = combineElements(dragged.elementId, other.elementId, recipes);
          if (product) {
            const midpoint = getMidpoint(endX, endY, other.x, other.y);

            const elementA = elements.find(el => el.id === dragged.elementId);
            const elementB = elements.find(el => el.id === other.elementId);
            const productItem = elements.find(el => el.id === product);

            // Consume ingredient elements
            updatedCanvas = updatedCanvas.filter(
              el => el.instanceId !== instanceId && el.instanceId !== other.instanceId
            );

            // Add newly combined product with entry spring bounce animation
            const combinedInstance: ActiveCanvasElement = {
              instanceId: `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              elementId: product,
              x: midpoint.x,
              y: midpoint.y,
              isNew: true,
            };
            updatedCanvas.push(combinedInstance);

            // Trigger procedural audio feedback
            playCombinationSound(dragged.elementId, other.elementId, product);

            // Trigger visual combination burst and particle animation
            if (elementA && elementB && productItem) {
              const productTrans = getElementTranslation(product);
              const animId = `comb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
              setActiveCombinations(prev => [
                ...prev,
                {
                  id: animId,
                  startX1: endX,
                  startY1: endY,
                  startX2: other.x,
                  startY2: other.y,
                  targetX: midpoint.x,
                  targetY: midpoint.y,
                  elementA,
                  elementB,
                  product: productItem,
                  productName: productTrans.name,
                },
              ]);
            }

            // Discover element unlock logic
            setDiscoveredIds(currentDiscovered => {
              let updatedDiscovered = [...currentDiscovered];
              if (!currentDiscovered.includes(product)) {
                updatedDiscovered.push(product);
                // Delay discovery modal slightly so player watches the combination animation on canvas
                const itemDetails = elements.find(el => el.id === product);
                if (itemDetails) {
                  setTimeout(() => {
                    setDiscoveredElement(itemDetails);
                  }, 750);
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
  
  const filteredElements = discoveredElements.filter(item => {
    const trans = getElementTranslation(item.id);
    const matchesSearch = trans.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'basic') return item.category === 'basic';
    if (activeTab === 'final') return item.isFinal;
    if (activeTab === 'combined') return item.category !== 'basic' && !item.isFinal;
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
          <Text style={styles.title}>{t('title')}</Text>
          <Text style={styles.subtitle}>
            {t('discovered')}: {discoveredIds.length} / {elements.length}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={[styles.glassButton, styles.langButton]} onPress={() => setShowLangMenu(true)}>
            <Text style={styles.langButtonText}>
              {LANGUAGES.find(l => l.code === currentLanguage)?.flag} {currentLanguage.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, styles.resetButton]} onPress={handleResetGame}>
            <Text style={styles.resetButtonText}>{t('resetGame')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, styles.clearButton]} onPress={handleClearCanvas}>
            <Text style={styles.clearButtonText}>{t('clearBoard')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Split Screen */}
      <View style={styles.mainLayout}>
        
        {/* Workspace Canvas (Left Area) */}
        <View style={styles.canvasContainer} onLayout={onCanvasLayout}>
          {canvasElements.length === 0 ? (
            <View style={styles.emptyCanvasHint}>
              <Text style={styles.hintText}>{t('workspaceCanvas')}</Text>
              <Text style={styles.subHintText}>{t('dragHint')}</Text>
            </View>
          ) : (
            canvasElements.map(el => {
              const item = elements.find(item => item.id === el.elementId);
              if (!item) return null;
              const trans = getElementTranslation(el.elementId);
              return (
                <DraggableCanvasItem
                  key={el.instanceId}
                  element={el}
                  item={item}
                  name={trans.name}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragRelease={handleDragRelease}
                />
              );
            })
          )}

          {/* Dotted vector proximity connector line */}
          {proximityLine && (
            <Svg style={styles.vectorOverlay} pointerEvents="none">
              <Path
                d={`M${proximityLine.x1} ${proximityLine.y1} L${proximityLine.x2} ${proximityLine.y2}`}
                stroke={proximityLine.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                opacity={0.8}
              />
            </Svg>
          )}

          {/* Active Elemental Combination Burst and Particle Animations */}
          {activeCombinations.map(anim => (
            <CombinationEffect
              key={anim.id}
              animation={anim}
              onComplete={handleCombinationComplete}
            />
          ))}

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

        {/* Right-hand Sidebar (Discovery Inventory with Deep Neon Green Theme) */}
        <View style={styles.sidebar}>
          <TextInput
            style={styles.searchBar}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor="#66BB6A"
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
                  {tab === 'all' && t('allTab')}
                  {tab === 'basic' && t('basicTab')}
                  {tab === 'combined' && t('combinedTab')}
                  {tab === 'final' && t('finalTab')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Scrollable grid listing discovered elements */}
          <ScrollView 
            contentContainerStyle={styles.sidebarGrid}
            showsVerticalScrollIndicator={false}
          >
            {filteredElements.map((item) => {
              const trans = getElementTranslation(item.id);
              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={[
                    styles.sidebarCard, 
                    item.isFinal && styles.finalSidebarCard
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSpawnElement(item.id)}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: `${item.color}18` }]}>
                    <ElementIcon path={item.svgPath} color={item.color} size={22} />
                  </View>
                  <Text style={styles.sidebarCardText} numberOfLines={1}>
                    {trans.name}
                  </Text>
                  {item.isFinal && <Text style={styles.finalBadge}>{t('finalBadge')}</Text>}
                </TouchableOpacity>
              );
            })}
            {filteredElements.length === 0 && (
              <Text style={styles.noItemsText}>{t('noItems')}</Text>
            )}
          </ScrollView>
        </View>

      </View>

      {/* Popover Celebration Modal for Discovered Items */}
      {discoveredElement && (() => {
        const trans = getElementTranslation(discoveredElement.id);
        return (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { borderColor: discoveredElement.color }]}>
              <Text style={styles.modalHeader}>{t('newDiscovery')}</Text>
              
              <View style={[styles.modalIconWrapper, { backgroundColor: `${discoveredElement.color}15`, shadowColor: discoveredElement.color }]}>
                <ElementIcon path={discoveredElement.svgPath} color={discoveredElement.color} size={56} />
              </View>

              <Text style={[styles.modalTitle, { color: discoveredElement.color }]}>
                {trans.name}
              </Text>
              
              <Text style={styles.modalDescription}>
                {trans.description}
              </Text>

              <TouchableOpacity 
                style={[styles.modalButton, { borderColor: discoveredElement.color }]} 
                onPress={() => setDiscoveredElement(null)}
              >
                <Text style={[styles.modalButtonText, { color: discoveredElement.color }]}>
                  {t('awesome')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* Language Selection Modal */}
      {showLangMenu && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>{t('selectLanguage')}</Text>
            
            <View style={styles.langList}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langItem,
                    currentLanguage === lang.code && styles.langItemActive
                  ]}
                  onPress={() => handleSelectLanguage(lang.code)}
                >
                  <Text style={styles.langItemText}>
                    {lang.flag}  {lang.label}
                  </Text>
                  {currentLanguage === lang.code && (
                    <Text style={styles.langActiveIndicator}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.langCloseButton} 
              onPress={() => setShowLangMenu(false)}
            >
              <Text style={styles.langCloseButtonText}>
                {currentLanguage === 'hu' ? 'Bezárás' : 'Close'}
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
    userSelect: 'none' as any,
  },
  subtitle: {
    fontSize: 12,
    color: '#80DEEA',
    marginTop: 2,
    fontWeight: '600',
    userSelect: 'none' as any,
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
    userSelect: 'none' as any,
  },
  clearButton: {
    borderColor: 'rgba(239, 83, 80, 0.4)',
    backgroundColor: 'rgba(239, 83, 80, 0.05)',
  },
  clearButtonText: {
    color: '#EF5350',
    fontSize: 12,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  // Canvas Styles
  canvasContainer: {
    flex: 2.2, // Narrowed sidebar gives canvas about 73% width
    backgroundColor: '#0E131F',
    position: 'relative',
    overflow: 'hidden',
  },
  vectorOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  emptyCanvasHint: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none' as any,
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
    userSelect: 'none' as any, // Prevent text selection highlight on drag
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
  // Sidebar Styles (Neon Green Translucent Background)
  sidebar: {
    flex: 0.8, // Sidebar narrowed to about 27%
    backgroundColor: 'rgba(7, 24, 13, 0.96)', // Translucent dark forest neon-green
    borderLeftWidth: 3,
    borderLeftColor: '#00E676',
    shadowColor: '#00E676',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
    padding: 8,
  },
  searchBar: {
    height: 38,
    backgroundColor: '#040D07',
    borderColor: 'rgba(0, 230, 118, 0.5)',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#A5D6A7', // Light green input text for premium contrast
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
    borderColor: 'rgba(0, 230, 118, 0.25)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tabButtonActive: {
    borderWidth: 1.5,
    borderColor: '#00E676', // Bright neon green active tab
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  tabButtonText: {
    color: '#81C784',
    fontSize: 9,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  tabButtonTextActive: {
    color: '#00E676',
  },
  sidebarGrid: {
    flexDirection: 'column',
    gap: 6,
    paddingBottom: 20,
  },
  sidebarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)', // Dark contrast bubble
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.12)',
    borderRadius: 10,
    padding: 6,
    userSelect: 'none' as any,
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
    color: '#ECEFF1', // Pure crisp white-gray for maximum readability
    fontSize: 11,
    fontWeight: '600',
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
    color: '#81C784',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    userSelect: 'none' as any,
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
    userSelect: 'none' as any,
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
    userSelect: 'none' as any,
  },
  modalDescription: {
    fontSize: 12,
    color: '#90A4AE',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
    userSelect: 'none' as any,
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
    userSelect: 'none' as any,
  },
  // Language Specific Styles
  langButton: {
    borderColor: 'rgba(0, 230, 118, 0.25)',
    backgroundColor: 'rgba(0, 230, 118, 0.05)',
  },
  langButtonText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  langList: {
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  langItemActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  langItemText: {
    color: '#ECEFF1',
    fontSize: 14,
    fontWeight: '500',
    userSelect: 'none' as any,
  },
  langActiveIndicator: {
    color: '#00E676',
    fontWeight: 'bold',
    fontSize: 14,
    userSelect: 'none' as any,
  },
  langCloseButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#90A4AE',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  langCloseButtonText: {
    color: '#90A4AE',
    fontSize: 12,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
});
