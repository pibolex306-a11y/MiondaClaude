// Utilidades generales de Mi Onda.

// Normaliza un nombre de artista: minúsculas, sin tildes, sin espacios extra.
export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Acorta un texto con puntos suspensivos.
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

// Iniciales de un nombre para mostrar en avatares sin emoji.
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Formatea una fecha relativa en español ("hace 2 h", "ayer").
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffH < 24) return `hace ${diffH} h`;
  if (diffD === 1) return 'ayer';
  if (diffD < 7) return `hace ${diffD} días`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

// Valida que un nombre tenga entre 2 y 30 caracteres, sin enlaces.
export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Muy corto. Escribe al menos 2 caracteres.';
  if (trimmed.length > 30) return 'Muy largo. Máximo 30 caracteres.';
  if (/https?:\/\//i.test(trimmed)) return 'Sin enlaces en el nombre.';
  if (/[<>]/.test(trimmed)) return 'Sin caracteres especiales como < o >.';
  return null;
}

// Genera un color de acento aleatorio armónico.
export function randomAccent(): string {
  const accents = [
    '#8B5CF6', '#22D3EE', '#F59E0B', '#10B981',
    '#EF4444', '#EC4899', '#3B82F6', '#84CC16',
  ];
  return accents[Math.floor(Math.random() * accents.length)];
}

// Une clases condicionalmente.
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
