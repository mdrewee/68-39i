export const getOrCreatePlayerId = (): string => {
  let pid = sessionStorage.getItem('party_player_id') || sessionStorage.getItem('taq_session_player_id');
  if (!pid) {
    pid = 'p_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
    sessionStorage.setItem('party_player_id', pid);
    sessionStorage.setItem('taq_session_player_id', pid);
  } else {
    sessionStorage.setItem('party_player_id', pid);
    sessionStorage.setItem('taq_session_player_id', pid);
  }
  return pid;
};

export const getOrCreatePlayerName = (fallback: string = 'عميل سري'): string => {
  let name = sessionStorage.getItem('party_player_name') || sessionStorage.getItem('taq_session_player_name') || localStorage.getItem('taghesi_playerName');
  if (!name || !name.trim()) {
    name = fallback;
  }
  sessionStorage.setItem('party_player_name', name);
  sessionStorage.setItem('taq_session_player_name', name);
  return name;
};

export const clearPlayerSession = (roomCode?: string): void => {
  sessionStorage.removeItem('party_player_id');
  sessionStorage.removeItem('party_player_name');
  sessionStorage.removeItem('taq_session_player_id');
  sessionStorage.removeItem('taq_session_player_name');
  if (roomCode) {
    const clean = roomCode.trim().toUpperCase();
    sessionStorage.removeItem(`taghesi_player_${clean}`);
    localStorage.removeItem(`taghesi_player_${clean}`);
  }
};
