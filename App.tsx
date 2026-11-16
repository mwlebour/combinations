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
  useWindowDimensions,
  Vibration,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import elementsData from './src/config/elements.json';
import recipesData from './src/config/recipes.json';
import translationsData from './src/config/translations.json';
import categoriesData from './src/config/categories.json';
import { ElementItem, ActiveCanvasElement, RecipeDictionary, ActiveCombinationAnimation, IconLayer } from './src/types/game';
import {
  combineElements,
  checkCollision,
  getMidpoint,
  calculateMagnetPosition,
  getCategoryProgress,
  getNewlyCompletedCategories,
  getRecipesFor,
  getUsesOf,
  getDerivationPath,
  getBouncePositions,
  getElementDepths,
  getRarityStars,
} from './src/utils/gameLogic';
import { CombinationEffect } from './src/components/CombinationEffect';
import { ElementAura } from './src/components/ElementAura';
import { Confetti } from './src/components/Confetti';
import { playCombinationSound, playBounceSound, playMilestoneSound, setAudioSettings } from './src/utils/audio';

const STORAGE_KEYS = {
  DISCOVERED: '@elemental_discovered',
  CANVAS: '@elemental_canvas',
  LANGUAGE: '@elemental_language',
  BEST_STREAK: '@elemental_best_streak',
  SETTINGS: '@elemental_settings',
};

const KNOWN_ELEMENT_IDS = new Set((elementsData as ElementItem[]).map(el => el.id));

const DEFAULT_STARTING_ELEMENTS = (elementsData as ElementItem[])
  .filter(el => el.category === 'basic')
  .map(el => el.id);

// Rarity (1-5 stars) of every element, from how many combination tiers it needs
const RARITY: Record<string, number> = Object.fromEntries(
  Object.entries(getElementDepths(recipesData as RecipeDictionary, DEFAULT_STARTING_ELEMENTS)).map(
    ([id, depth]) => [id, getRarityStars(depth)]
  )
);

const STREAK_MILESTONES = [5, 10, 20];

interface GameSettings {
  soundOn: boolean;
  volume: number; // 0-1
  vibrationOn: boolean;
}
const DEFAULT_SETTINGS: GameSettings = { soundOn: true, volume: 0.75, vibrationOn: true };

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hu', label: 'Magyar', flag: '🇭🇺' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'la', label: 'Latina', flag: '🏛️' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'sq', label: 'Shqip', flag: '🇦🇱' },
  { code: 'sr', label: 'Српски', flag: '🇷🇸' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'bg', label: 'Български', flag: '🇧🇬' },
] as const;

type Language = typeof LANGUAGES[number]['code'];

interface CategoryInfo {
  emoji: string;
  color: string;
  name: Record<string, string>;
  title: Record<string, string>;
}
const CATEGORIES = categoriesData as Record<string, CategoryInfo>;

type SidebarTab = 'all' | 'basic' | 'combined' | 'final' | 'progress';

// Helper: Custom SVG Icon Renderer
// Renders `layers` (multiple fills, e.g. a wooden handle plus a metal head) when
// provided; otherwise falls back to the single path/color pair.
const ElementIcon = ({ path, color, size = 32, layers }: { path: string; color: string; size?: number; layers?: IconLayer[] }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {layers && layers.length > 0
      ? layers.map((layer, i) => <Path key={i} d={layer.svgPath} fill={layer.color} />)
      : <Path d={path} fill={color} />}
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
  onDragCancel: (instanceId: string) => void;
  onTap: (instanceId: string) => void;
  onLongPress: (instanceId: string) => void;
  selected: boolean;
}

// A press that moves less than this many pixels counts as a tap or a hold, not a drag
const TAP_SLOP = 8;
const LONG_PRESS_MS = 500;

const DraggableCanvasItem = ({
  element,
  item,
  name,
  onDragStart,
  onDragMove,
  onDragRelease,
  onDragCancel,
  onTap,
  onLongPress,
  selected,
}: DraggableCanvasItemProps) => {
  const lastPosition = useRef({ x: element.x, y: element.y });
  const spawnScale = useRef(new Animated.Value(element.isNew ? 0 : 1)).current;
  // Offset that springs back to zero after bouncing off a non-matching item
  const bounceOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    const from = element.bounceFrom;
    if (!from) return;
    bounceOffset.setValue({ x: from.x - element.x, y: from.y - element.y });
    Animated.spring(bounceOffset, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      tension: 140,
      useNativeDriver: false,
    }).start();
  }, [element.bounceFrom?.id]);

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

  // PanResponder is created once via useRef, so its callbacks must not close over
  // props/state directly (they'd freeze at this item's first mount, e.g. when
  // rehydrated from storage before canvasLayout has been measured). Route through
  // a ref that's refreshed every render so handlers always see current values.
  const handlersRef = useRef({ onDragStart, onDragMove, onDragRelease, onDragCancel, onTap, onLongPress });
  useEffect(() => {
    handlersRef.current = { onDragStart, onDragMove, onDragRelease, onDragCancel, onTap, onLongPress };
  });

  // Per-gesture state: a press becomes a drag once it moves past TAP_SLOP; a
  // press held still for LONG_PRESS_MS opens the item's info instead.
  const gesture = useRef({ moved: false, longPressed: false, timer: null as ReturnType<typeof setTimeout> | null });
  const clearLongPressTimer = () => {
    if (gesture.current.timer) clearTimeout(gesture.current.timer);
    gesture.current.timer = null;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        gesture.current.moved = false;
        gesture.current.longPressed = false;
        clearLongPressTimer();
        gesture.current.timer = setTimeout(() => {
          if (!gesture.current.moved) {
            gesture.current.longPressed = true;
            handlersRef.current.onLongPress(element.instanceId);
          }
        }, LONG_PRESS_MS);
        handlersRef.current.onDragStart(element.instanceId, lastPosition.current.x, lastPosition.current.y);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gesture.current.longPressed) return;
        if (!gesture.current.moved && Math.hypot(gestureState.dx, gestureState.dy) < TAP_SLOP) return;
        gesture.current.moved = true;
        clearLongPressTimer();
        handlersRef.current.onDragMove(element.instanceId, gestureState.dx, gestureState.dy);
      },
      onPanResponderRelease: () => {
        clearLongPressTimer();
        if (gesture.current.longPressed) {
          handlersRef.current.onDragCancel(element.instanceId);
        } else if (!gesture.current.moved) {
          handlersRef.current.onDragCancel(element.instanceId);
          handlersRef.current.onTap(element.instanceId);
        } else {
          handlersRef.current.onDragRelease(element.instanceId, lastPosition.current.x, lastPosition.current.y);
        }
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
        handlersRef.current.onDragCancel(element.instanceId);
      },
    })
  ).current;

  useEffect(() => clearLongPressTimer, []);

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
          transform: [{ translateX: bounceOffset.x }, { translateY: bounceOffset.y }, { scale: spawnScale }],
        },
        item.isFinal && styles.finalStateGlow,
        selected && styles.canvasElementSelected,
      ]}
    >
      <ElementAura elementId={item.id} />
      <ElementIcon path={item.svgPath} color={item.color} layers={item.iconLayers} size={28} />
      <Text style={styles.canvasElementText} numberOfLines={1}>
        {name}
      </Text>
    </Animated.View>
  );
};

// ★★★☆☆ under an element's name
const RarityStars = ({ stars }: { stars: number }) => (
  <Text style={styles.rarityStars} accessibilityLabel={`${stars}/5`}>
    <Text style={stars === 5 ? styles.rarityStarsLegendary : styles.rarityStarsFilled}>{'★'.repeat(stars)}</Text>
    <Text style={styles.rarityStarsEmpty}>{'★'.repeat(5 - stars)}</Text>
  </Text>
);

// Full-screen gold flash for a 5-star discovery
const GoldFlash = () => {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.6, duration: 160, useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: false }),
    ]).start();
  }, []);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.goldFlash, { opacity: flash }]} />;
};

const SILHOUETTE_COLOR = '#2A3445';

// Phones and tablets: the sidebar scrolls by touch, so only the card's icon
// starts a drag there. With a mouse the whole card can be dragged.
const IS_COARSE_POINTER =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

interface SidebarDragHandlers {
  onStart: (elementId: string, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  onCancel: () => void;
}

// Pan responder for dragging an element from the sidebar onto the board.
//
// Mouse: wraps the whole card and only takes over once the pointer has moved,
// so a plain click still reaches the card's onPress (spawn in the middle).
//
// Touch: attached to the card's icon. react-native-web only lets ancestors of
// the current responder steal a gesture, so the icon claims the touch at the
// start and handles all three cases itself: tap = spawn, hold = info, move =
// drag. Touches elsewhere on the card scroll the sidebar as usual.
const useSidebarDrag = (
  elementId: string,
  handlers: SidebarDragHandlers,
  claimOnStart: boolean,
  onTap: () => void,
  onHold: () => void
) => {
  const ref = useRef({ handlers, onTap, onHold });
  ref.current = { handlers, onTap, onHold };
  const state = useRef({ dragging: false, held: false, timer: null as ReturnType<typeof setTimeout> | null });
  const clearTimer = () => {
    if (state.current.timer) clearTimeout(state.current.timer);
    state.current.timer = null;
  };
  return useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => claimOnStart,
      onMoveShouldSetPanResponderCapture: (_evt, g) => !claimOnStart && Math.hypot(g.dx, g.dy) > TAP_SLOP,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_evt, g) => {
        state.current.held = false;
        clearTimer();
        if (claimOnStart) {
          state.current.dragging = false;
          state.current.timer = setTimeout(() => {
            if (!state.current.dragging) {
              state.current.held = true;
              ref.current.onHold();
            }
          }, LONG_PRESS_MS);
        } else {
          state.current.dragging = true;
          ref.current.handlers.onStart(elementId, g.moveX, g.moveY);
        }
      },
      onPanResponderMove: (_evt, g) => {
        if (state.current.held) return;
        if (!state.current.dragging) {
          if (Math.hypot(g.dx, g.dy) < TAP_SLOP) return;
          state.current.dragging = true;
          clearTimer();
          ref.current.handlers.onStart(elementId, g.moveX, g.moveY);
        }
        ref.current.handlers.onMove(g.moveX, g.moveY);
      },
      onPanResponderRelease: (_evt, g) => {
        clearTimer();
        if (state.current.dragging) ref.current.handlers.onDrop(g.moveX, g.moveY);
        else if (!state.current.held) ref.current.onTap();
        state.current.dragging = false;
      },
      onPanResponderTerminate: () => {
        clearTimer();
        if (state.current.dragging) ref.current.handlers.onCancel();
        state.current.dragging = false;
      },
    })
  ).current;
};

interface SidebarCardProps {
  item: ElementItem;
  name: string;
  isNarrow: boolean;
  finalLabel: string;
  infoLabel: string;
  drag: SidebarDragHandlers;
  onSpawn: (elementId: string) => void;
  onInfo: (elementId: string) => void;
}

const SidebarCard = ({ item, name, isNarrow, finalLabel, infoLabel, drag, onSpawn, onInfo }: SidebarCardProps) => {
  // On touch the icon handles its own tap; browsers then also send a click to
  // the card, which must not spawn a second copy.
  const lastIconTap = useRef(0);
  const pan = useSidebarDrag(
    item.id,
    drag,
    IS_COARSE_POINTER,
    () => {
      lastIconTap.current = Date.now();
      onSpawn(item.id);
    },
    () => onInfo(item.id)
  );
  const card = (
    <TouchableOpacity
      style={[
        styles.sidebarCard,
        isNarrow && styles.sidebarCardNarrow,
        // With a mouse the drag wrapper takes the grid cell, so the card fills it
        isNarrow && !IS_COARSE_POINTER && styles.sidebarCardFill,
        item.isFinal && styles.finalSidebarCard,
      ]}
      activeOpacity={0.7}
      onPress={() => {
        if (Date.now() - lastIconTap.current > 600) onSpawn(item.id);
      }}
      onLongPress={() => onInfo(item.id)}
    >
      <TouchableOpacity
        style={styles.infoButton}
        onPress={() => onInfo(item.id)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityLabel={infoLabel}
      >
        <Text style={styles.infoButtonText}>i</Text>
      </TouchableOpacity>
      <View
        {...(IS_COARSE_POINTER ? pan.panHandlers : {})}
        style={[styles.iconWrapper, { backgroundColor: `${item.color}18` }, IS_COARSE_POINTER && styles.dragHandle]}
      >
        <ElementIcon path={item.svgPath} color={item.color} layers={item.iconLayers} size={22} />
      </View>
      <Text style={[styles.sidebarCardText, isNarrow && styles.sidebarCardTextNarrow]} numberOfLines={1}>
        {name}
      </Text>
      {item.isFinal && <Text style={styles.finalBadge}>{finalLabel}</Text>}
    </TouchableOpacity>
  );
  if (IS_COARSE_POINTER) return card;
  return (
    <View {...pan.panHandlers} style={isNarrow ? styles.sidebarCardDragWrapperNarrow : undefined}>
      {card}
    </View>
  );
};

// One step of the recipe book's "Show path" tree; steps fade in one after another
const PathStep = ({ index, children }: { index: number; children: React.ReactNode }) => {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 12) * 110,
      useNativeDriver: false,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        styles.recipeRow,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// Header badge for the discovery streak; pops each time the streak grows
const StreakBadge = ({ streak, label }: { streak: number; label: string }) => {
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pop.setValue(1.35);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: false }).start();
  }, [streak]);
  const hot = Math.min(streak, 10) / 10;
  return (
    <Animated.View
      style={[
        styles.glassButton,
        styles.streakBadge,
        { transform: [{ scale: pop }], shadowOpacity: 0.3 + hot * 0.6, shadowRadius: 4 + hot * 10 },
      ]}
      accessibilityLabel={`${label}: ${streak}`}
    >
      <Text style={styles.streakBadgeText}>🔥 {streak}</Text>
    </Animated.View>
  );
};

// Below this viewport width, the sidebar drops beneath the canvas and the
// inventory switches from a list to a compact wrapping grid.
const NARROW_BREAKPOINT = 700;

export default function App() {
  const elements = elementsData as ElementItem[];
  const recipes = recipesData as RecipeDictionary;

  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < NARROW_BREAKPOINT;

  // Game States
  const [discoveredIds, setDiscoveredIds] = useState<string[]>(DEFAULT_STARTING_ELEMENTS);
  const [canvasElements, setCanvasElements] = useState<ActiveCanvasElement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('all');
  
  // Localization States
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [showLangMenu, setShowLangMenu] = useState(false);
  
  // Proximity Vector Line state connecting snapping pairs
  const [proximityLine, setProximityLine] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string } | null>(null);

  // Active combination animation effects playing on canvas
  const [activeCombinations, setActiveCombinations] = useState<ActiveCombinationAnimation[]>([]);

  // Highlight Discovery Modal State
  const [discoveredElement, setDiscoveredElement] = useState<ElementItem | null>(null);

  // Reset Game Confirmation Modal State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Recipe book: the element whose details (made from / used in) are open
  const [detailElementId, setDetailElementId] = useState<string | null>(null);

  // Categories completed by recent discoveries, shown one at a time as achievements
  const [pendingAchievements, setPendingAchievements] = useState<string[]>([]);

  // Recipe book "Show path" toggle (reset whenever another element is opened)
  const [showPath, setShowPath] = useState(false);
  useEffect(() => setShowPath(false), [detailElementId]);

  // Silhouette collection of every element
  const [showCollection, setShowCollection] = useState(false);

  // New discoveries in a row without a failed (bounced) combination. Session only.
  const [streak, setStreak] = useState(0);
  const streakRef = useRef(0);
  const [bestStreak, setBestStreak] = useState(0);
  const bestStreakRef = useRef(0);
  // Toast + confetti shown when the streak hits 5, 10 or 20
  const [milestone, setMilestone] = useState<{ n: number; id: number } | null>(null);
  const updateStreak = (value: number) => {
    streakRef.current = value;
    setStreak(value);
    if (value > bestStreakRef.current) {
      bestStreakRef.current = value;
      setBestStreak(value);
      AsyncStorage.setItem(STORAGE_KEYS.BEST_STREAK, String(value)).catch(() => {});
    }
    const level = STREAK_MILESTONES.indexOf(value);
    if (level >= 0) {
      playMilestoneSound(level + 1);
      buzz([0, 30, 60, 30, 60, 60]);
      setMilestone({ n: value, id: Date.now() });
    }
  };
  useEffect(() => {
    if (!milestone) return;
    const timer = setTimeout(() => setMilestone(null), 2600);
    return () => clearTimeout(timer);
  }, [milestone?.id]);

  // Sound & vibration settings (persisted)
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const applySettings = (next: GameSettings, persist: boolean) => {
    settingsRef.current = next;
    setSettings(next);
    setAudioSettings({ muted: !next.soundOn, volume: next.volume });
    if (persist) AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next)).catch(() => {});
  };
  // Short vibration on phones that support it (ignored elsewhere)
  const buzz = (pattern: number | number[]) => {
    if (!IS_COARSE_POINTER || !settingsRef.current.vibrationOn) return;
    try {
      Vibration.vibrate(pattern);
    } catch {
      // Not supported on this device
    }
  };

  // Game Complete Modal State (dismissed for the current session once acknowledged)
  const [gameCompleteDismissed, setGameCompleteDismissed] = useState(false);

  // Keep track of canvas sizing for containment checks
  const [canvasLayout, setCanvasLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Tap-to-combine (phones only): the board item picked by the first tap
  const tapToCombine = isNarrow && IS_COARSE_POINTER;
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  // Element being dragged out of the sidebar, drawn as a floating tile
  const [sidebarDragId, setSidebarDragId] = useState<string | null>(null);
  const sidebarDragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const canvasRef = useRef<View>(null);

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

  const getCategoryName = (category: string) => {
    const info = CATEGORIES[category];
    return info ? info.name[currentLanguage] || info.name.en : category;
  };

  const getCategoryTitle = (category: string) => {
    const info = CATEGORIES[category];
    return info ? info.title[currentLanguage] || info.title.en : category;
  };

  // 1. Initial State Loading from Storage
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const storedDiscovered = await AsyncStorage.getItem(STORAGE_KEYS.DISCOVERED);
        const storedCanvas = await AsyncStorage.getItem(STORAGE_KEYS.CANVAS);
        const storedLang = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
        const storedBest = await AsyncStorage.getItem(STORAGE_KEYS.BEST_STREAK);
        const storedSettings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (storedBest) {
          const best = parseInt(storedBest, 10) || 0;
          bestStreakRef.current = best;
          setBestStreak(best);
        }
        if (storedSettings) {
          applySettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) }, false);
        } else {
          applySettings(DEFAULT_SETTINGS, false);
        }
        
        if (storedDiscovered) {
          // Drop ids of elements that were removed from the game since this save
          const storedIds: string[] = JSON.parse(storedDiscovered);
          const parsedDiscovered = storedIds.filter(id => KNOWN_ELEMENT_IDS.has(id));
          const missingBasics = DEFAULT_STARTING_ELEMENTS.filter(id => !parsedDiscovered.includes(id));
          const mergedDiscovered = missingBasics.length > 0
            ? [...parsedDiscovered, ...missingBasics]
            : parsedDiscovered;
          setDiscoveredIds(mergedDiscovered);
          if (missingBasics.length > 0 || parsedDiscovered.length !== storedIds.length) {
            await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(mergedDiscovered));
          }
        } else {
          // Setup defaults
          await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(DEFAULT_STARTING_ELEMENTS));
        }
        
        if (storedCanvas) {
          const storedItems: ActiveCanvasElement[] = JSON.parse(storedCanvas);
          setCanvasElements(storedItems.filter(el => KNOWN_ELEMENT_IDS.has(el.elementId)));
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
      const persistedCanvas = newCanvas.map(({ bounceFrom, ...rest }) => rest);
      await AsyncStorage.setItem(STORAGE_KEYS.CANVAS, JSON.stringify(persistedCanvas));
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

  const makeInstanceId = () => `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Keeps an 80x80 item fully on the board
  const clampToCanvas = (x: number, y: number) => ({
    x: Math.round(Math.min(Math.max(x, 0), Math.max(0, canvasLayout.width - 80))),
    y: Math.round(Math.min(Math.max(y, 0), Math.max(0, canvasLayout.height - 80))),
  });

  // Double-tap: a fresh copy of the item, just below and to the right
  const handleDuplicate = (instanceId: string) => {
    const source = canvasElements.find(el => el.instanceId === instanceId);
    if (!source) return;
    const pos = clampToCanvas(source.x + 26, source.y + 26);
    const copy: ActiveCanvasElement = { instanceId: makeInstanceId(), elementId: source.elementId, ...pos, isNew: true };
    const updatedCanvas = [...canvasElements, copy];
    setCanvasElements(updatedCanvas);
    saveState(discoveredIds, updatedCanvas);
  };

  const handleCanvasTap = (instanceId: string) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === instanceId && now - last.time < 350) {
      lastTapRef.current = null;
      setSelectedInstanceId(null);
      handleDuplicate(instanceId);
      return;
    }
    lastTapRef.current = { id: instanceId, time: now };
    if (!tapToCombine) return;

    if (selectedInstanceId === null || !canvasElements.some(el => el.instanceId === selectedInstanceId)) {
      setSelectedInstanceId(instanceId);
    } else if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    } else {
      // Second tap on another item: fly the first one onto it and combine (or bounce)
      const target = canvasElements.find(el => el.instanceId === instanceId);
      const first = selectedInstanceId;
      setSelectedInstanceId(null);
      lastTapRef.current = null;
      if (target) handleDragRelease(first, target.x, target.y);
    }
  };

  const handleCanvasLongPress = (instanceId: string) => {
    const el = canvasElements.find(item => item.instanceId === instanceId);
    if (!el) return;
    setSelectedInstanceId(null);
    setDetailElementId(el.elementId);
  };

  const handleDragCancel = (instanceId: string) => {
    delete dragStartPositions.current[instanceId];
    setProximityLine(null);
  };

  // Dragging an element straight from the sidebar onto a spot on the board
  const sidebarDrag: SidebarDragHandlers = {
    onStart: (elementId, x, y) => {
      sidebarDragPos.setValue({ x: x - 40, y: y - 40 });
      setSidebarDragId(elementId);
    },
    onMove: (x, y) => sidebarDragPos.setValue({ x: x - 40, y: y - 40 }),
    onCancel: () => setSidebarDragId(null),
    onDrop: (x, y) => {
      const elementId = sidebarDragId;
      setSidebarDragId(null);
      if (!elementId || !canvasRef.current) return;
      canvasRef.current.measureInWindow((cx, cy, width, height) => {
        if (x < cx || y < cy || x > cx + width || y > cy + height) return;
        const pos = clampToCanvas(x - cx - 40, y - cy - 40);
        const instance: ActiveCanvasElement = { instanceId: makeInstanceId(), elementId, ...pos, isNew: true };
        setCanvasElements(prev => [...prev, instance]);
        // Run the normal drop logic so it combines with (or bounces off) whatever it lands on
        handleDragRelease(instance.instanceId, pos.x, pos.y);
      });
    },
  };

  // 3. Clear, Reset, & Language Actions
  const handleClearCanvas = () => {
    setSelectedInstanceId(null);
    setCanvasElements([]);
    setProximityLine(null);
    setActiveCombinations([]);
    saveState(discoveredIds, []);
  };

  const handleResetGame = async () => {
    setDiscoveredIds(DEFAULT_STARTING_ELEMENTS);
    setGameCompleteDismissed(false);
    setPendingAchievements([]);
    setDetailElementId(null);
    updateStreak(0);
    setCanvasElements([]);
    setProximityLine(null);
    setActiveCombinations([]);
    await AsyncStorage.setItem(STORAGE_KEYS.DISCOVERED, JSON.stringify(DEFAULT_STARTING_ELEMENTS));
    await AsyncStorage.setItem(STORAGE_KEYS.CANVAS, JSON.stringify([]));
  };

  const handleRequestResetGame = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmResetGame = async () => {
    setShowResetConfirm(false);
    await handleResetGame();
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
      // Closest overlapping item that has no recipe with the dragged one
      let mismatch: { other: ActiveCanvasElement; distance: number } | null = null;

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
            buzz(discoveredIds.includes(product) ? 20 : 45);

            // A brand-new discovery extends the streak; known recipes leave it as is
            if (!discoveredIds.includes(product)) {
              updateStreak(streakRef.current + 1);
            }

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
                  streak: streakRef.current,
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
                const completed = getNewlyCompletedCategories(elements, currentDiscovered, updatedDiscovered);
                if (itemDetails) {
                  setTimeout(() => {
                    setDiscoveredElement(itemDetails);
                    if (completed.length > 0) {
                      setPendingAchievements(prev => [...prev, ...completed.filter(c => !prev.includes(c))]);
                    }
                  }, 750);
                }
              }
              saveState(updatedDiscovered, updatedCanvas);
              return updatedDiscovered;
            });

            combined = true;
            break;
          }

          const distance = Math.hypot(c2x - c1x, c2y - c1y);
          if (!mismatch || distance < mismatch.distance) {
            mismatch = { other, distance };
          }
        }
      }

      // Dropped onto something it doesn't combine with: bounce the two apart
      if (!combined && mismatch) {
        const target = mismatch.other;
        const positions = getBouncePositions(
          { x: endX, y: endY },
          { x: target.x, y: target.y },
          { width: canvasLayout.width, height: canvasLayout.height }
        );
        const bounceId = Date.now();
        updatedCanvas = updatedCanvas.map(el => {
          if (el.instanceId === instanceId) {
            return { ...el, ...positions.dragged, bounceFrom: { x: endX, y: endY, id: bounceId } };
          }
          if (el.instanceId === target.instanceId) {
            return { ...el, ...positions.other, bounceFrom: { x: target.x, y: target.y, id: bounceId } };
          }
          return el;
        });
        playBounceSound();
        buzz([0, 15, 40, 15]);
        updateStreak(0);
      }

      if (!combined) {
        saveState(discoveredIds, updatedCanvas);
      }

      return updatedCanvas;
    });
  };

  // 5. Filter Discovered Sidebar Lists
  const discoveredElements = elements.filter(el => discoveredIds.includes(el.id));

  // Every element discovered means there is nothing left to combine
  const isGameComplete = discoveredElements.length === elements.length;
  
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

  // Collection groups: starting elements first, then categories alphabetically
  const collectionSections = Array.from(new Set(elements.map(el => el.category)))
    .sort((a, b) =>
      a === 'basic' ? -1 : b === 'basic' ? 1 : getCategoryName(a).localeCompare(getCategoryName(b))
    )
    .map(category => ({ category, items: elements.filter(el => el.category === category) }));

  const categoryProgress = getCategoryProgress(elements, discoveredIds).sort((a, b) =>
    getCategoryName(a.category).localeCompare(getCategoryName(b.category))
  );

  // Small tappable chip for an element in the recipe book; "?" when undiscovered
  const renderElementChip = (id: string | null, key: string) => {
    const item = id ? elements.find(el => el.id === id) : undefined;
    if (!item || !discoveredIds.includes(item.id)) {
      return (
        <View key={key} style={[styles.recipeChip, styles.recipeChipUnknown]}>
          <Text style={styles.recipeChipUnknownText}>?</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        key={key}
        style={[styles.recipeChip, { borderColor: `${item.color}66` }]}
        onPress={() => setDetailElementId(item.id)}
      >
        <ElementIcon path={item.svgPath} color={item.color} layers={item.iconLayers} size={16} />
        <Text style={styles.recipeChipText} numberOfLines={1}>{getElementTranslation(item.id).name}</Text>
      </TouchableOpacity>
    );
  };

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    setCanvasLayout(event.nativeEvent.layout);
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar style="light" />
      
      {/* Header Panel */}
      <View style={[styles.header, isNarrow && styles.headerNarrow]}>
        <View>
          <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{t('title')}</Text>
          <Text style={styles.subtitle}>
            {t('discovered')}: {discoveredIds.length} / {elements.length}
          </Text>
        </View>
        <View style={[styles.headerButtons, isNarrow && styles.headerButtonsNarrow]}>
          {streak >= 2 && <StreakBadge streak={streak} label={t('streak')} />}
          <TouchableOpacity
            style={[styles.glassButton, styles.settingsButton]}
            onPress={() => setShowSettings(true)}
            accessibilityLabel={t('settings')}
          >
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, styles.collectionButton]} onPress={() => setShowCollection(true)}>
            <Text style={styles.collectionButtonText}>📖 {t('collection')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, styles.langButton]} onPress={() => setShowLangMenu(true)}>
            <Text style={styles.langButtonText}>
              {LANGUAGES.find(l => l.code === currentLanguage)?.flag} {currentLanguage.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, styles.resetButton]} onPress={handleRequestResetGame}>
            <Text style={styles.resetButtonText}>{t('resetGame')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, styles.clearButton]} onPress={handleClearCanvas}>
            <Text style={styles.clearButtonText}>{t('clearBoard')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Split Screen (stacks vertically on narrow screens) */}
      <View style={[styles.mainLayout, isNarrow && styles.mainLayoutNarrow]}>

        {/* Workspace Canvas (Left Area) */}
        <View
          ref={canvasRef}
          style={[styles.canvasContainer, isNarrow && styles.canvasContainerNarrow]}
          onLayout={onCanvasLayout}
        >
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
                  onDragCancel={handleDragCancel}
                  onTap={handleCanvasTap}
                  onLongPress={handleCanvasLongPress}
                  selected={el.instanceId === selectedInstanceId}
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
        <View style={[styles.sidebar, isNarrow && styles.sidebarNarrow]}>
          <TextInput
            style={styles.searchBar}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor="#66BB6A"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Filtering Categories */}
          <View style={styles.tabContainer}>
            {(['all', 'basic', 'combined', 'final', 'progress'] as const).map((tab) => (
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
                  {tab === 'progress' && t('progressTab')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Per-category progress bars with achievement badges */}
          {activeTab === 'progress' ? (
            <ScrollView contentContainerStyle={styles.progressList} showsVerticalScrollIndicator={false}>
              <View style={[styles.progressRow, styles.bestStreakRow]}>
                <Text style={styles.progressBadge}>🔥</Text>
                <Text style={[styles.progressName, { flex: 1 }]}>{t('bestStreak')}</Text>
                <Text style={styles.progressCount}>{bestStreak}</Text>
              </View>
              {categoryProgress.map(({ category, found, total }) => {
                const info = CATEGORIES[category];
                const color = info?.color ?? '#00E676';
                const complete = found === total;
                return (
                  <View key={category} style={[styles.progressRow, complete && styles.progressRowComplete]}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.progressBadge, !complete && styles.progressBadgeLocked]}>
                        {info?.emoji ?? '★'}
                      </Text>
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressName} numberOfLines={1}>{getCategoryName(category)}</Text>
                        <Text
                          style={[styles.progressTitle, { color: complete ? '#FFD54F' : '#4B5B75' }]}
                          numberOfLines={1}
                        >
                          {complete ? '🏆 ' : '🔒 '}{getCategoryTitle(category)}
                        </Text>
                      </View>
                      <Text style={styles.progressCount}>{found}/{total}</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round((found / total) * 100)}%`, backgroundColor: complete ? '#FFD54F' : color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
          <ScrollView
            contentContainerStyle={[styles.sidebarGrid, isNarrow && styles.sidebarGridNarrow]}
            showsVerticalScrollIndicator={false}
          >
            {filteredElements.map((item) => {
              const trans = getElementTranslation(item.id);
              return (
                <SidebarCard
                  key={item.id}
                  item={item}
                  name={trans.name}
                  isNarrow={isNarrow}
                  finalLabel={t('finalBadge')}
                  infoLabel={`${trans.name}: ${t('madeFrom')} / ${t('usedIn')}`}
                  drag={sidebarDrag}
                  onSpawn={handleSpawnElement}
                  onInfo={setDetailElementId}
                />
              );
            })}
            {filteredElements.length === 0 && (
              <Text style={styles.noItemsText}>{t('noItems')}</Text>
            )}
          </ScrollView>
          )}
        </View>

      </View>

      {/* Popover Celebration Modal for Discovered Items */}
      {discoveredElement && (() => {
        const trans = getElementTranslation(discoveredElement.id);
        return (
          <View style={styles.modalOverlay}>
            {RARITY[discoveredElement.id] === 5 && <GoldFlash key={discoveredElement.id} />}
            <View style={[styles.modalContent, { borderColor: discoveredElement.color }]}>
              <Text style={styles.modalHeader}>{t('newDiscovery')}</Text>
              
              <View style={[styles.modalIconWrapper, { backgroundColor: `${discoveredElement.color}15`, shadowColor: discoveredElement.color }]}>
                <ElementIcon path={discoveredElement.svgPath} color={discoveredElement.color} layers={discoveredElement.iconLayers} size={56} />
              </View>

              <Text style={[styles.modalTitle, { color: discoveredElement.color }]}>
                {trans.name}
              </Text>
              <RarityStars stars={RARITY[discoveredElement.id] ?? 1} />
              
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

      {/* Collection: every element, undiscovered ones as dark silhouettes */}
      {showCollection && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.collectionModal]}>
            <Text style={styles.modalHeader}>
              📖 {t('collection').toUpperCase()} · {discoveredIds.length} / {elements.length}
            </Text>
            <ScrollView style={styles.collectionScroll} contentContainerStyle={styles.collectionScrollContent}>
              {collectionSections.map(({ category, items }) => {
                const found = items.filter(el => discoveredIds.includes(el.id)).length;
                const info = CATEGORIES[category];
                return (
                  <View key={category} style={styles.collectionSection}>
                    <Text style={styles.collectionSectionTitle}>
                      {info ? `${info.emoji} ${getCategoryName(category)}` : t('basicTab')} · {found}/{items.length}
                    </Text>
                    <View style={styles.collectionGrid}>
                      {items.map(item => {
                        const known = discoveredIds.includes(item.id);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.collectionTile, known && { borderColor: `${item.color}55` }]}
                            disabled={!known}
                            onPress={() => setDetailElementId(item.id)}
                          >
                            <ElementIcon
                              path={item.svgPath}
                              color={known ? item.color : SILHOUETTE_COLOR}
                              layers={
                                known
                                  ? item.iconLayers
                                  : item.iconLayers?.map(layer => ({ ...layer, color: SILHOUETTE_COLOR }))
                              }
                              size={26}
                            />
                            <Text
                              style={[styles.collectionTileText, !known && styles.collectionTileTextUnknown]}
                              numberOfLines={1}
                            >
                              {known ? getElementTranslation(item.id).name : '???'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.langCloseButton} onPress={() => setShowCollection(false)}>
              <Text style={styles.langCloseButtonText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recipe Book: how an element is made and what it is used in */}
      {detailElementId && (() => {
        const item = elements.find(el => el.id === detailElementId);
        if (!item) return null;
        const trans = getElementTranslation(item.id);
        const madeFrom = getRecipesFor(item.id, recipes);
        const discovered = new Set(discoveredIds);
        // Known uses first; undiscovered results stay as "?" slots
        const uses = getUsesOf(item.id, recipes).sort(
          (a, b) => Number(discovered.has(b.product)) - Number(discovered.has(a.product))
        );
        const category = CATEGORIES[item.category];
        return (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.recipeModal, { borderColor: item.color }]}>
              <ScrollView style={styles.recipeScroll} contentContainerStyle={styles.recipeScrollContent}>
                {category && (
                  <Text style={styles.modalHeader}>
                    {category.emoji} {getCategoryName(item.category).toUpperCase()}
                  </Text>
                )}
                <View style={[styles.modalIconWrapper, { backgroundColor: `${item.color}15`, shadowColor: item.color }]}>
                  <ElementIcon path={item.svgPath} color={item.color} layers={item.iconLayers} size={56} />
                </View>
                <Text style={[styles.modalTitle, { color: item.color }]}>{trans.name}</Text>
                <RarityStars stars={RARITY[item.id] ?? 1} />
                <Text style={[styles.modalDescription, { marginBottom: 16 }]}>{trans.description}</Text>

                <Text style={styles.recipeSectionTitle}>{t('madeFrom')}</Text>
                {madeFrom.length === 0 ? (
                  <Text style={styles.recipeNote}>{t('startingElement')}</Text>
                ) : (
                  madeFrom.map(([a, b]) => (
                    <View key={`${a}+${b}`} style={styles.recipeRow}>
                      {renderElementChip(a, 'a')}
                      <Text style={styles.recipeOperator}>+</Text>
                      {renderElementChip(b, 'b')}
                    </View>
                  ))
                )}

                {madeFrom.length > 0 && (
                  <TouchableOpacity
                    style={[styles.pathToggle, { borderColor: `${item.color}88` }]}
                    onPress={() => setShowPath(prev => !prev)}
                  >
                    <Text style={[styles.pathToggleText, { color: item.color }]}>
                      🌳 {showPath ? t('hidePath') : t('showPath')}
                    </Text>
                  </TouchableOpacity>
                )}
                {showPath &&
                  getDerivationPath(item.id, recipes, DEFAULT_STARTING_ELEMENTS).map((step, index) => (
                    <PathStep key={`${item.id}-${step.product}`} index={index}>
                      <Text style={styles.pathStepNumber}>{index + 1}</Text>
                      {renderElementChip(step.a, 'a')}
                      <Text style={styles.recipeOperator}>+</Text>
                      {renderElementChip(step.b, 'b')}
                      <Text style={styles.recipeOperator}>→</Text>
                      {renderElementChip(step.product, 'product')}
                    </PathStep>
                  ))}

                <Text style={styles.recipeSectionTitle}>{t('usedIn')}</Text>
                {uses.length === 0 ? (
                  <Text style={styles.recipeNote}>{t('finalElementNote')}</Text>
                ) : (
                  uses.map(({ partner, product }) => {
                    const known = discovered.has(product);
                    return (
                      <View key={`${partner}>${product}`} style={styles.recipeRow}>
                        <Text style={styles.recipeOperator}>+</Text>
                        {renderElementChip(known ? partner : null, 'partner')}
                        <Text style={styles.recipeOperator}>→</Text>
                        {renderElementChip(known ? product : null, 'product')}
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.confirmButtonRow}>
                <TouchableOpacity
                  style={[styles.confirmButton, { borderColor: item.color }]}
                  onPress={() => {
                    handleSpawnElement(item.id);
                    setDetailElementId(null);
                  }}
                >
                  <Text style={[styles.recipeButtonText, { color: item.color }]}>{t('placeOnBoard')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { borderColor: '#90A4AE' }]}
                  onPress={() => setDetailElementId(null)}
                >
                  <Text style={[styles.recipeButtonText, { color: '#90A4AE' }]}>{t('close')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Achievement Modal: a whole category was just completed */}
      {!discoveredElement && pendingAchievements.length > 0 && (() => {
        const category = pendingAchievements[0];
        const info = CATEGORIES[category];
        return (
          <View style={styles.modalOverlay}>
            <Confetti key={category} />
            <View style={[styles.modalContent, { borderColor: '#FFD54F' }]}>
              <Text style={styles.modalHeader}>{t('achievementUnlocked')}</Text>
              <Text style={styles.achievementEmoji}>{info?.emoji ?? '🏆'}</Text>
              <Text style={[styles.modalTitle, { color: '#FFD54F' }]}>{getCategoryTitle(category)}</Text>
              <Text style={styles.modalDescription}>
                {t('achievementDescription').replace('{category}', getCategoryName(category))}
              </Text>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: '#FFD54F' }]}
                onPress={() => setPendingAchievements(prev => prev.slice(1))}
              >
                <Text style={[styles.modalButtonText, { color: '#FFD54F' }]}>{t('awesome')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* Game Complete Modal, shown once the final discovery popover is closed */}
      {isGameComplete && !discoveredElement && pendingAchievements.length === 0 && !gameCompleteDismissed && (
        <View style={styles.modalOverlay}>
          <Confetti count={120} />
          <View style={[styles.modalContent, { borderColor: '#FFD54F' }]}>
            <Text style={[styles.modalHeader, { fontSize: 48 }]}>🏆</Text>
            <Text style={[styles.modalTitle, { color: '#FFD54F' }]}>{t('gameCompleteTitle')}</Text>
            <Text style={styles.modalDescription}>{t('gameCompleteDescription')}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: '#FFD54F' }]}
              onPress={() => setGameCompleteDismissed(true)}
            >
              <Text style={[styles.modalButtonText, { color: '#FFD54F' }]}>{t('awesome')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reset Game Confirmation Modal */}
      {showResetConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>{t('confirmResetTitle')}</Text>
            <Text style={styles.modalDescription}>{t('confirmResetDescription')}</Text>

            <View style={styles.confirmButtonRow}>
              <TouchableOpacity
                style={[styles.confirmButton, { borderColor: '#00E676' }]}
                onPress={handleConfirmResetGame}
              >
                <Text style={[styles.modalButtonText, { color: '#00E676' }]}>{t('yes')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { borderColor: '#EF5350' }]}
                onPress={() => setShowResetConfirm(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#EF5350' }]}>{t('no')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Language Selection Modal */}
      {showLangMenu && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>{t('selectLanguage')}</Text>
            
            <ScrollView nativeID="lang-scroll" style={styles.langScroll} contentContainerStyle={styles.langList} showsVerticalScrollIndicator={true}>
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
            </ScrollView>

            <TouchableOpacity 
              style={styles.langCloseButton} 
              onPress={() => setShowLangMenu(false)}
            >
              <Text style={styles.langCloseButtonText}>
                {t('close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Streak milestone: big toast with confetti, fades by itself */}
      {milestone && (
        <View style={styles.milestoneLayer} pointerEvents="none">
          <Confetti key={milestone.id} count={60} />
          <View style={styles.milestoneToast}>
            <Text style={styles.milestoneText}>🔥 {t('streakMilestone').replace('{n}', String(milestone.n))}</Text>
          </View>
        </View>
      )}

      {/* Sound & vibration settings */}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>⚙️ {t('settings').toUpperCase()}</Text>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>🔊 {t('sound')}</Text>
              <TouchableOpacity
                style={[styles.toggle, settings.soundOn && styles.toggleOn]}
                onPress={() => applySettings({ ...settings, soundOn: !settings.soundOn }, true)}
              >
                <Text style={[styles.toggleText, settings.soundOn && styles.toggleTextOn]}>
                  {settings.soundOn ? t('on') : t('off')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.settingsRow, !settings.soundOn && { opacity: 0.4 }]}>
              <Text style={styles.settingsLabel}>🎚️ {t('volume')}</Text>
              <View style={styles.volumeOptions}>
                {[0.25, 0.5, 0.75, 1].map(level => (
                  <TouchableOpacity
                    key={level}
                    disabled={!settings.soundOn}
                    style={[styles.volumeOption, Math.abs(settings.volume - level) < 0.01 && styles.toggleOn]}
                    onPress={() => {
                      applySettings({ ...settings, volume: level }, true);
                      playBounceSound();
                    }}
                  >
                    <Text style={[styles.toggleText, Math.abs(settings.volume - level) < 0.01 && styles.toggleTextOn]}>
                      {Math.round(level * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {IS_COARSE_POINTER && (
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>📳 {t('vibration')}</Text>
                <TouchableOpacity
                  style={[styles.toggle, settings.vibrationOn && styles.toggleOn]}
                  onPress={() => {
                    const next = { ...settings, vibrationOn: !settings.vibrationOn };
                    applySettings(next, true);
                    if (next.vibrationOn) buzz(40);
                  }}
                >
                  <Text style={[styles.toggleText, settings.vibrationOn && styles.toggleTextOn]}>
                    {settings.vibrationOn ? t('on') : t('off')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={[styles.langCloseButton, { marginTop: 12 }]} onPress={() => setShowSettings(false)}>
              <Text style={styles.langCloseButtonText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tile following the pointer while dragging from the sidebar */}
      {sidebarDragId && (() => {
        const item = elements.find(el => el.id === sidebarDragId);
        if (!item) return null;
        return (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.canvasElement,
              styles.dragGhost,
              {
                borderColor: item.color,
                shadowColor: item.color,
                transform: [{ translateX: sidebarDragPos.x }, { translateY: sidebarDragPos.y }],
              },
            ]}
          >
            <ElementIcon path={item.svgPath} color={item.color} layers={item.iconLayers} size={28} />
            <Text style={styles.canvasElementText} numberOfLines={1}>
              {getElementTranslation(item.id).name}
            </Text>
          </Animated.View>
        );
      })()}
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
    flexWrap: 'wrap',
    rowGap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2332',
    backgroundColor: '#0B0E14',
  },
  headerNarrow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ECEFF1',
    letterSpacing: 0.5,
    userSelect: 'none' as any,
  },
  titleNarrow: {
    fontSize: 16,
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
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerButtonsNarrow: {
    width: '100%',
    gap: 6,
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
  mainLayoutNarrow: {
    flexDirection: 'column',
  },
  // Canvas Styles
  canvasContainer: {
    flex: 2.2, // Narrowed sidebar gives canvas about 73% width
    backgroundColor: '#0E131F',
    position: 'relative',
    overflow: 'hidden',
  },
  canvasContainerNarrow: {
    flex: 1.3, // Stacked layout: canvas keeps the larger share of vertical space
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
  sidebarNarrow: {
    flex: 1, // Stacked below the canvas; grid layout uses width efficiently
    borderLeftWidth: 0,
    borderTopWidth: 3,
    borderTopColor: '#00E676',
    shadowOffset: { width: 0, height: -2 },
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
  sidebarGridNarrow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  sidebarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)', // Dark contrast bubble
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.12)',
    borderRadius: 10,
    padding: 6,
    paddingRight: 34, // room for the info button
    userSelect: 'none' as any,
  },
  sidebarCardNarrow: {
    flexDirection: 'column',
    width: '31%',
    paddingVertical: 10,
    paddingHorizontal: 6,
    paddingTop: 14,
    justifyContent: 'center',
  },
  sidebarCardFill: {
    width: '100%',
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
  sidebarCardTextNarrow: {
    marginLeft: 0,
    marginTop: 6,
    // Longhands rather than `flex: 0`, which collapses the label to zero height on web
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'stretch',
    textAlign: 'center',
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
  infoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(128, 222, 234, 0.6)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  infoButtonText: {
    color: '#80DEEA',
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'italic',
    lineHeight: 16,
    userSelect: 'none' as any,
  },
  dragHandle: {
    touchAction: 'none',
    cursor: 'grab',
  } as any,
  sidebarCardDragWrapperNarrow: {
    width: '31%',
  },
  dragGhost: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.9,
    zIndex: 1000,
  },
  canvasElementSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  progressList: {
    gap: 8,
    paddingBottom: 20,
  },
  progressRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.12)',
    borderRadius: 10,
    padding: 8,
  },
  progressRowComplete: {
    borderColor: 'rgba(255,213,79,0.4)',
    backgroundColor: 'rgba(255,213,79,0.05)',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBadge: {
    fontSize: 18,
    marginRight: 8,
    userSelect: 'none' as any,
  },
  progressBadgeLocked: {
    opacity: 0.35,
  },
  progressLabels: {
    flex: 1,
  },
  progressName: {
    color: '#ECEFF1',
    fontSize: 11,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  progressTitle: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
    userSelect: 'none' as any,
  },
  progressCount: {
    color: '#A5D6A7',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
    userSelect: 'none' as any,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  recipeModal: {
    maxWidth: 360,
    maxHeight: '90%',
  },
  recipeScroll: {
    width: '100%',
    marginBottom: 16,
  },
  recipeScrollContent: {
    alignItems: 'center',
  },
  recipeSectionTitle: {
    alignSelf: 'flex-start',
    color: '#80DEEA',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
    userSelect: 'none' as any,
  },
  recipeNote: {
    alignSelf: 'flex-start',
    color: '#90A4AE',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 4,
    userSelect: 'none' as any,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  recipeOperator: {
    color: '#4B5B75',
    fontSize: 13,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  recipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 130,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  recipeChipText: {
    color: '#ECEFF1',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    userSelect: 'none' as any,
  },
  recipeChipUnknown: {
    minWidth: 32,
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  recipeChipUnknownText: {
    color: '#4B5B75',
    fontSize: 12,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  recipeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    userSelect: 'none' as any,
  },
  achievementEmoji: {
    fontSize: 48,
    marginBottom: 12,
    userSelect: 'none' as any,
  },
  collectionButton: {
    borderColor: 'rgba(128, 222, 234, 0.35)',
    backgroundColor: 'rgba(128, 222, 234, 0.05)',
  },
  collectionButtonText: {
    color: '#80DEEA',
    fontSize: 12,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  streakBadge: {
    borderColor: 'rgba(255, 112, 67, 0.6)',
    backgroundColor: 'rgba(255, 112, 67, 0.12)',
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 0 },
  },
  streakBadgeText: {
    color: '#FFAB91',
    fontSize: 12,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  collectionModal: {
    width: '92%',
    maxWidth: 560,
    maxHeight: '90%',
  },
  collectionScroll: {
    width: '100%',
    marginBottom: 16,
  },
  collectionScrollContent: {
    gap: 14,
  },
  collectionSection: {
    gap: 6,
  },
  collectionSectionTitle: {
    color: '#80DEEA',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    userSelect: 'none' as any,
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  collectionTile: {
    width: 68,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  collectionTileText: {
    color: '#ECEFF1',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    alignSelf: 'stretch',
    userSelect: 'none' as any,
  },
  collectionTileTextUnknown: {
    color: '#4B5B75',
  },
  pathToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 8,
  },
  pathToggleText: {
    fontSize: 11,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  pathStepNumber: {
    color: '#4B5B75',
    fontSize: 10,
    fontWeight: 'bold',
    minWidth: 14,
    userSelect: 'none' as any,
  },
  rarityStars: {
    fontSize: 14,
    letterSpacing: 2,
    marginTop: -2,
    marginBottom: 10,
    userSelect: 'none' as any,
  },
  rarityStarsFilled: {
    color: '#FFD54F',
  },
  rarityStarsLegendary: {
    color: '#FFD54F',
    textShadowColor: '#FFB300',
    textShadowRadius: 8,
  },
  rarityStarsEmpty: {
    color: '#2A3445',
  },
  goldFlash: {
    backgroundColor: '#FFD54F',
    zIndex: 998,
  },
  bestStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: 'rgba(255, 112, 67, 0.35)',
  },
  settingsButton: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
  },
  settingsButtonText: {
    fontSize: 13,
    userSelect: 'none' as any,
  },
  settingsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingsLabel: {
    color: '#ECEFF1',
    fontSize: 13,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  toggle: {
    minWidth: 64,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  toggleOn: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
  },
  toggleText: {
    color: '#90A4AE',
    fontSize: 12,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  toggleTextOn: {
    color: '#00E676',
  },
  volumeOptions: {
    flexDirection: 'row',
    gap: 4,
  },
  volumeOption: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  milestoneLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 1001, // above the discovery popup that appears right after
  },
  milestoneToast: {
    marginTop: 72, // just under the header, clear of popups' content
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FF7043',
    backgroundColor: 'rgba(17, 23, 38, 0.95)',
    shadowColor: '#FF7043',
    shadowOpacity: 0.8,
    shadowRadius: 18,
  },
  milestoneText: {
    color: '#FFAB91',
    fontSize: 22,
    fontWeight: 'bold',
    userSelect: 'none' as any,
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
  confirmButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    minWidth: 96,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
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
  langScroll: {
    width: '100%',
    maxHeight: 320,
    marginBottom: 20,
  },
  langList: {
    width: '100%',
    gap: 8,
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
