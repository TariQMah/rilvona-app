export type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  honey: string;
  leaf: string;
  danger: string;
  warning: string;
  overlay: string;
};

export const lightPalette: Palette = {
  background: '#F4F0E8',
  surface: '#FFFcf7',
  surfaceMuted: '#EBE4D8',
  ink: '#1C1915',
  muted: '#6E675F',
  line: '#E3DACE',
  accent: '#E25B12',
  accentInk: '#FFF8F3',
  honey: '#F0A202',
  leaf: '#1F7A68',
  danger: '#B42318',
  warning: '#8A5A00',
  overlay: 'rgba(28, 25, 21, 0.45)',
};

export const darkPalette: Palette = {
  background: '#12100E',
  surface: '#1C1916',
  surfaceMuted: '#2A251F',
  ink: '#F6F1E8',
  muted: '#B7AFA4',
  line: '#3A332C',
  accent: '#F08A3E',
  accentInk: '#1C120C',
  honey: '#F0A202',
  leaf: '#7DCFB6',
  danger: '#FF8B80',
  warning: '#F0C36A',
  overlay: 'rgba(0, 0, 0, 0.6)',
};
