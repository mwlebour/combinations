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

});
