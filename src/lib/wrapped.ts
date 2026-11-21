// Ciclos de Wrapped: cambiar solo estas dos constantes para reconfigurar.
export const CYCLE_MONTHS = 4;
export const CYCLE_START_MONTH = 1; // 1 = enero

// Devuelve la clave del ciclo, ej. "2026-Q1" para meses ene–abr si CYCLE_START_MONTH=1
export function getCycleKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const zeroBasedOffset = month - CYCLE_START_MONTH;
  const cycleIndex = zeroBasedOffset >= 0
    ? Math.floor(zeroBasedOffset / CYCLE_MONTHS)
    : Math.floor((12 + zeroBasedOffset) / CYCLE_MONTHS) - 1;

  const cycleYear = cycleIndex >= 0 ? year : year - 1;
  return `${cycleYear}-C${cycleIndex >= 0 ? cycleIndex + 1 : CYCLE_MONTHS / CYCLE_MONTHS + cycleIndex + 1}`;
}

// Devuelve los month_keys que componen un ciclo, ej. ["2026-01","2026-02","2026-03","2026-04"]
export function getCycleMonths(cycleKey: string): string[] {
  const [yearStr, cycleStr] = cycleKey.split('-C');
  const year = parseInt(yearStr, 10);
  const cycleIndex = parseInt(cycleStr, 10) - 1;

  const months: string[] = [];
  for (let i = 0; i < CYCLE_MONTHS; i++) {
    const absMonth = CYCLE_START_MONTH + cycleIndex * CYCLE_MONTHS + i;
    const adjustedYear = Math.floor((absMonth - 1) / 12) + year;
    const adjustedMonth = ((absMonth - 1) % 12) + 1;
    months.push(`${adjustedYear}-${String(adjustedMonth).padStart(2, '0')}`);
  }
  return months;
}

// Inicio del ciclo (primer día del primer mes)
export function getCycleStart(cycleKey: string): Date {
  const months = getCycleMonths(cycleKey);
  const [year, month] = months[0].split('-').map(Number);
  return new Date(year, month - 1, 1);
}

// Fin del ciclo (último día del último mes, 23:59:59)
export function getCycleEnd(cycleKey: string): Date {
  const months = getCycleMonths(cycleKey);
  const [year, month] = months[months.length - 1].split('-').map(Number);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

// Devuelve el month_key del mes actual
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
