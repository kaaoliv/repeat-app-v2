// Duração longa (tempo total de vida): "9meses 15d 6h", "12h", "34 min"
export function formatLongDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return "0 min";
  const days = Math.floor(totalSeconds / 86400);
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (months > 0) {
    const parts = [`${months}m`];
    if (remDays > 0) parts.push(`${remDays}d`);
    if (hours > 0) parts.push(`${hours}h`);
    return parts.join(" ");
  }
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
}

// Quebra o tempo em partes pra exibir no hero (número + unidade separados)
export function breakdownDuration(totalSeconds: number | null | undefined) {
  const s = Math.max(0, totalSeconds ?? 0);
  const days = Math.floor(s / 86400);
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const totalHours = Math.floor(s / 3600);
  return { months, days: remDays, hours, minutes, totalHours, totalDays: days };
}

// Duração de faixa curta: "3:45"
export function formatTrackDuration(totalSeconds: number | null | undefined): string | null {
  if (!totalSeconds) return null;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Duração de álbum média: "42 min", "1h12"
export function formatAlbumDuration(totalSeconds: number | null | undefined): string | null {
  if (!totalSeconds) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, "0")}`;
  return `${minutes} min`;
}
