// Themed background auras for basic elements when placed on the board.
export type AuraType = 'particles' | 'ripple' | 'sweep' | 'bolt';
export type ParticleShape = 'ember' | 'dust' | 'grain' | 'bubble' | 'sparkle';
export type ParticleDirection = 'up' | 'side';

export interface AuraSpec {
  type: AuraType;
  color: string;
  secondaryColor?: string;
  shape?: ParticleShape;
  direction?: ParticleDirection;
}

// Keyed by element id. Only basic/starting elements have an aura defined.
export const AURA_CONFIG: Record<string, AuraSpec> = {
  fire: { type: 'particles', color: '#FF7043', secondaryColor: '#FFCA28', shape: 'ember', direction: 'up' },
  water: { type: 'ripple', color: '#4FC3F7' },
  earth: { type: 'particles', color: '#8D6E63', secondaryColor: '#6D4C41', shape: 'dust', direction: 'up' },
  air: { type: 'sweep', color: 'rgba(224,242,254,0.5)' },
  sand: { type: 'particles', color: '#D7B36A', secondaryColor: '#C9A24B', shape: 'grain', direction: 'side' },
  lightning: { type: 'bolt', color: '#FFF176' },
  ice: { type: 'particles', color: '#B3E5FC', secondaryColor: '#E1F5FE', shape: 'sparkle', direction: 'up' },
  metal: { type: 'sweep', color: 'rgba(230,230,230,0.55)' },
  wood: { type: 'ripple', color: '#8BC34A' },
  crude_oil: { type: 'particles', color: '#212121', secondaryColor: '#424242', shape: 'bubble', direction: 'up' },
};
