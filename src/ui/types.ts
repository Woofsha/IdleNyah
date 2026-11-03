// src/ui/types.ts
import type { GameState } from '../core/types';
import type { SfxType } from '../audio/types';

export type TabId = 'chores' | 'multipliers' | 'territory' | 'sanctuaries';

export type BulkBuyMode = 1 | 10 | 25 | -1;

export interface UiCallbacks {
  playSfx?: (type: SfxType) => void;
}

export interface DialogueLine {
  speaker: 'nyah' | 'fifi' | 'master';
  speakerName: string;
  portrait: 'nyah_native' | 'fifi_native';
  text: string;
}

export interface StoryModalSequence {
  id: string;
  title: string;
  triggerCondition: (state: GameState) => boolean;
  priority: number;
  lines: DialogueLine[];
}

export interface AmbientQuotePools {
  idle: string[];
  click: string[];
  frenzy: string[];
  catch: string[];
}
