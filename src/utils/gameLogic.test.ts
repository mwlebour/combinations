import { combineElements, checkCollision, getMidpoint, calculateMagnetPosition } from './gameLogic';
import { RecipeDictionary } from '../types/game';
import actualRecipesData from '../config/recipes.json';

const actualRecipes = actualRecipesData as RecipeDictionary;

describe('Game Logic Utilities', () => {
  
  // Test combination matching
  describe('combineElements', () => {
    const mockRecipes: RecipeDictionary = {
      'fire+sand': 'glass',
      'glass+glass': 'glasses',
      'earth+water': 'mud'
    };

    it('should successfully combine matching ingredients alphabetically', () => {
      const result = combineElements('fire', 'sand', mockRecipes);
      expect(result).toBe('glass');
    });

    it('should combine matching ingredients in reverse order (order independence)', () => {
      const result = combineElements('sand', 'fire', mockRecipes);
      expect(result).toBe('glass');
    });

    it('should combine matching identical ingredients', () => {
      const result = combineElements('glass', 'glass', mockRecipes);
      expect(result).toBe('glasses');
    });

    it('should handle case insensitivity', () => {
      const result = combineElements('FIRE', 'Sand', mockRecipes);
      expect(result).toBe('glass');
    });

    it('should return null if combination does not exist', () => {
      const result = combineElements('fire', 'water', mockRecipes);
      expect(result).toBeNull();
    });

    it('should handle invalid arguments gracefully', () => {
      expect(combineElements('', 'sand', mockRecipes)).toBeNull();
      expect(combineElements('fire', '', mockRecipes)).toBeNull();
      // @ts-ignore
      expect(combineElements('fire', 'sand', null)).toBeNull();
    });

    // Test new actual elements combinations
    describe('Actual Production Recipes', () => {
      it('should combine Earth + Earth into Rock', () => {
        const result = combineElements('earth', 'earth', actualRecipes);
        expect(result).toBe('rock');
      });

      it('should combine Mountain + Lava into Volcano', () => {
        const result = combineElements('mountain', 'lava', actualRecipes);
        expect(result).toBe('volcano');
      });

      it('should combine Clay + Fire into Brick', () => {
        const result = combineElements('clay', 'fire', actualRecipes);
        expect(result).toBe('brick');
      });

      it('should combine Brick + Wood into House', () => {
        const result = combineElements('brick', 'wood', actualRecipes);
        expect(result).toBe('house');
      });

      it('should combine animal + life into friend', () => {
        expect(combineElements('animal', 'life', actualRecipes)).toBe('friend');
      });

      it('should combine life + life into love', () => {
        expect(combineElements('life', 'life', actualRecipes)).toBe('love');
      });

      it('should combine animal + love into pepper', () => {
        expect(combineElements('animal', 'love', actualRecipes)).toBe('pepper');
      });

      it('should combine plastic + wood into boat', () => {
        expect(combineElements('plastic', 'wood', actualRecipes)).toBe('boat');
      });

      it('should combine fire + air into hot_air', () => {
        expect(combineElements('fire', 'air', actualRecipes)).toBe('hot_air');
      });

      it('should combine water + air into cold_air', () => {
        expect(combineElements('water', 'air', actualRecipes)).toBe('cold_air');
      });

      it('should combine hot_air + cold_air into wind', () => {
        expect(combineElements('hot_air', 'cold_air', actualRecipes)).toBe('wind');
      });

      it('should combine wind + boat into sailboat', () => {
        expect(combineElements('wind', 'boat', actualRecipes)).toBe('sailboat');
      });

      it('should combine salt_crystal + pickaxe into diamond', () => {
        expect(combineElements('salt_crystal', 'pickaxe', actualRecipes)).toBe('diamond');
      });

      it('should combine gold + diamond into jewelry', () => {
        expect(combineElements('gold', 'diamond', actualRecipes)).toBe('jewelry');
      });

      it('should combine leather + air into football', () => {
        expect(combineElements('leather', 'air', actualRecipes)).toBe('football');
      });

      it('should combine crude_oil + paper into art', () => {
        expect(combineElements('crude_oil', 'paper', actualRecipes)).toBe('art');
      });

      it('should combine art + life into happy', () => {
        expect(combineElements('art', 'life', actualRecipes)).toBe('happy');
      });

      it('should combine earth + ocean into globe', () => {
        expect(combineElements('earth', 'ocean', actualRecipes)).toBe('globe');
      });

      it('should combine rock + fire into meteor', () => {
        expect(combineElements('rock', 'fire', actualRecipes)).toBe('meteor');
      });

      it('should combine meteor + globe into new_age', () => {
        expect(combineElements('meteor', 'globe', actualRecipes)).toBe('new_age');
      });

      it('should combine new_age + animal into monkey', () => {
        expect(combineElements('new_age', 'animal', actualRecipes)).toBe('monkey');
      });

      it('should combine monkey + homework into human', () => {
        expect(combineElements('monkey', 'homework', actualRecipes)).toBe('human');
      });

      it('should combine metal + crude_oil into tech', () => {
        expect(combineElements('metal', 'crude_oil', actualRecipes)).toBe('tech');
      });

      it('should combine tech + steel into car', () => {
        expect(combineElements('tech', 'steel', actualRecipes)).toBe('car');
      });

      it('should combine tech + human into cyborg', () => {
        expect(combineElements('tech', 'human', actualRecipes)).toBe('cyborg');
      });

      it('should combine tech + fire into engine', () => {
        expect(combineElements('tech', 'fire', actualRecipes)).toBe('engine');
      });

      it('should combine engine + steel into rocket', () => {
        expect(combineElements('engine', 'steel', actualRecipes)).toBe('rocket');
      });

      it('should combine rocket + human into astronaut', () => {
        expect(combineElements('rocket', 'human', actualRecipes)).toBe('astronaut');
      });

      it('should combine lightning + human into god', () => {
        expect(combineElements('lightning', 'human', actualRecipes)).toBe('god');
      });

      it('should combine fire + human into devil', () => {
        expect(combineElements('fire', 'human', actualRecipes)).toBe('devil');
      });

      it('should combine devil + god into super_human', () => {
        expect(combineElements('devil', 'god', actualRecipes)).toBe('super_human');
      });

      it('should combine car + lightning into time_travel', () => {
        expect(combineElements('car', 'lightning', actualRecipes)).toBe('time_travel');
      });

      it('should combine plastic + ocean into pollution', () => {
        expect(combineElements('plastic', 'ocean', actualRecipes)).toBe('pollution');
      });

      it('should combine pollution + life into climate_change', () => {
        expect(combineElements('pollution', 'life', actualRecipes)).toBe('climate_change');
      });

      it('should combine rock + pickaxe into powder', () => {
        expect(combineElements('rock', 'pickaxe', actualRecipes)).toBe('powder');
      });

      it('should combine powder + steel into gun', () => {
        expect(combineElements('powder', 'steel', actualRecipes)).toBe('gun');
      });

      it('should combine gun + human into soldier', () => {
        expect(combineElements('gun', 'human', actualRecipes)).toBe('soldier');
      });

      it('should combine soldier + globe into apocalypse', () => {
        expect(combineElements('soldier', 'globe', actualRecipes)).toBe('apocalypse');
      });

      it('should combine rock + globe into moon', () => {
        expect(combineElements('rock', 'globe', actualRecipes)).toBe('moon');
      });

      it('should combine astronaut + moon into moon_landing', () => {
        expect(combineElements('astronaut', 'moon', actualRecipes)).toBe('moon_landing');
      });
    });
  });

  // Test distance collision detection
  describe('checkCollision', () => {
    const threshold = 50;

    it('should return true if points overlap exactly', () => {
      expect(checkCollision(100, 100, 100, 100, threshold)).toBe(true);
    });

    it('should return true if distance is within the threshold boundary', () => {
      // Distance is 30
      expect(checkCollision(100, 100, 130, 100, threshold)).toBe(true);
      // Distance is sqrt(30^2 + 30^2) = 42.4
      expect(checkCollision(100, 100, 130, 130, threshold)).toBe(true);
    });

    it('should return true if distance is exactly at threshold boundary', () => {
      expect(checkCollision(100, 100, 150, 100, threshold)).toBe(true);
    });

    it('should return false if distance exceeds threshold', () => {
      // Distance is 51
      expect(checkCollision(100, 100, 151, 100, threshold)).toBe(false);
      // Distance is sqrt(40^2 + 40^2) = 56.5
      expect(checkCollision(100, 100, 140, 140, threshold)).toBe(false);
    });
  });

  // Test midpoint coordinate calculations
  describe('getMidpoint', () => {
    it('should calculate the exact midpoint', () => {
      const mid = getMidpoint(100, 200, 200, 400);
      expect(mid).toEqual({ x: 150, y: 300 });
    });

    it('should round calculations to nearest integer pixels', () => {
      const mid = getMidpoint(100, 200, 105, 204);
      // x is (100 + 105) / 2 = 102.5 -> rounds to 103
      // y is (200 + 204) / 2 = 202
      expect(mid).toEqual({ x: 103, y: 202 });
    });
  });

  // Test magnetic attraction snap position
  describe('calculateMagnetPosition', () => {
    const dragX = 100;
    const dragY = 100;
    const targetX = 120; // 20px delta X
    const targetY = 110; // 10px delta Y
    const threshold = 80;

    it('should attract and snap position toward target when within threshold distance', () => {
      const snapForce = 0.5; // 50% pull
      const result = calculateMagnetPosition(dragX, dragY, targetX, targetY, threshold, snapForce);
      
      expect(result.magnetActive).toBe(true);
      // x: 100 + (120 - 100) * 0.5 = 110
      // y: 100 + (110 - 100) * 0.5 = 105
      expect(result.x).toBe(110);
      expect(result.y).toBe(105);
    });

    it('should attract more strongly with higher snap force', () => {
      const snapForce = 0.8; // 80% pull
      const result = calculateMagnetPosition(dragX, dragY, targetX, targetY, threshold, snapForce);
      
      expect(result.magnetActive).toBe(true);
      // x: 100 + 20 * 0.8 = 116
      // y: 100 + 10 * 0.8 = 108
      expect(result.x).toBe(116);
      expect(result.y).toBe(108);
    });

    it('should not attract and keep raw coordinates when outside threshold distance', () => {
      const farTargetX = 250;
      const farTargetY = 250;
      const result = calculateMagnetPosition(dragX, dragY, farTargetX, farTargetY, threshold);
      
      expect(result.magnetActive).toBe(false);
      expect(result.x).toBe(dragX);
      expect(result.y).toBe(dragY);
    });
  });

  // Test particle config generation for combination animations
  describe('generateParticleConfigs', () => {
    it('should generate the specified count of particles', () => {
      const { generateParticleConfigs } = require('./gameLogic');
      const particles = generateParticleConfigs(
        24,
        { id: 'fire', color: '#FF5722' },
        { id: 'sand', color: '#FFD54F' },
        { id: 'glass', color: '#E0F7FA', category: 'optics' }
      );

      expect(particles).toHaveLength(24);
      particles.forEach((p: any) => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('angle');
        expect(p).toHaveProperty('distance');
        expect(p).toHaveProperty('size');
        expect(p).toHaveProperty('color');
        expect(p).toHaveProperty('shape');
        expect(p).toHaveProperty('duration');
        expect(p).toHaveProperty('delay');
      });
    });

    it('should include fire embers and upward drift when fire is an ingredient', () => {
      const { generateParticleConfigs } = require('./gameLogic');
      // Mock random function that triggers ember shape
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.1) // angle jitter
        .mockReturnValueOnce(0.5) // distance
        .mockReturnValueOnce(0.5) // size
        .mockReturnValueOnce(0.1) // color index
        .mockReturnValueOnce(0.2) // shapeRoll (< 0.4 triggers ember)
        .mockReturnValueOnce(0.5) // driftY
        .mockReturnValueOnce(0.5) // duration
        .mockReturnValueOnce(0.5) // delay
        .mockReturnValueOnce(0.5) // driftY round
        .mockReturnValueOnce(0.5); // rotation

      const particles = generateParticleConfigs(
        1,
        { id: 'fire', color: '#FF5722' },
        { id: 'sand', color: '#FFD54F' },
        { id: 'glass', color: '#E0F7FA', category: 'optics' },
        mockRandom
      );

      expect(particles[0].shape).toBe('ember');
      expect(particles[0].driftY).toBeLessThan(0); // upward drift
    });

    it('should include glass/optics sparkle or diamond shapes for glass product', () => {
      const { generateParticleConfigs } = require('./gameLogic');
      const particles = generateParticleConfigs(
        30,
        { id: 'fire', color: '#FF5722' },
        { id: 'sand', color: '#FFD54F' },
        { id: 'glass', color: '#E0F7FA', category: 'optics' }
      );

      const shapes = particles.map((p: any) => p.shape);
      expect(shapes.some((s: string) => s === 'sparkle' || s === 'diamond')).toBe(true);
    });
  });

});
