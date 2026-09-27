// Themed background auras for basic elements when placed on the board.
export type AuraType = 'particles' | 'ripple' | 'bolt' | 'flame' | 'orbit' | 'wind' | 'shine' | 'leaf' | 'sweep' | 'twinkle';
export type ParticleShape = 'dust' | 'grain' | 'bubble' | 'sparkle' | 'frost';
export type ParticleDirection = 'up' | 'down' | 'side';

export interface AuraSpec {
  type: AuraType;
  color: string;
  secondaryColor?: string;
  shape?: ParticleShape;
  direction?: ParticleDirection;
  // Duration in ms of the type's main loop (e.g. rotation speed for 'shine'). Type-specific default if omitted.
  speed?: number;
}

// Keyed by element id. Only basic/starting elements have an aura defined.
export const AURA_CONFIG: Record<string, AuraSpec> = {
  fire: { type: 'flame', color: '#FF6F3C', secondaryColor: '#FFD54F' },
  water: { type: 'ripple', color: '#4FC3F7' },
  earth: { type: 'orbit', color: '#8D6E63', secondaryColor: '#6D4C41' },
  air: { type: 'wind', color: 'rgba(224,242,254,0.75)' },
  sand: { type: 'particles', color: '#D7B36A', secondaryColor: '#C9A24B', shape: 'grain', direction: 'side' },
  lightning: { type: 'bolt', color: '#FFF176' },
  ice: { type: 'particles', color: '#B3E5FC', secondaryColor: '#E1F5FE', shape: 'frost', direction: 'down' },
  metal: { type: 'sweep', color: 'rgba(230,230,230,0.55)' },
  gold: { type: 'shine', color: '#FFD54F', secondaryColor: '#FFF9C4', speed: 2600 },
  silver: { type: 'twinkle', color: '#ECEFF1', secondaryColor: '#B0BEC5' },
  wood: { type: 'leaf', color: '#8BC34A', secondaryColor: '#C77B3B' },
  crude_oil: { type: 'particles', color: '#212121', secondaryColor: '#424242', shape: 'bubble', direction: 'up' },
};
