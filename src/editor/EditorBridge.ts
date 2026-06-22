import type { AiVideoProps } from '../types';

export interface JpEditorBridge {
  setProps(patch: Partial<AiVideoProps>): void;
  loadPreview(full: AiVideoProps): void;
  play(): void;
  pause(): void;
  seekTo(frame: number): void;
  getCurrentFrame(): number;
  isPlaying(): boolean;
}

declare global {
  interface Window {
    __JP_EDITOR?: JpEditorBridge;
  }
}
