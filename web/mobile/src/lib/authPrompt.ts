import { useEffect, useState } from "react";

/**
 * Global giriş-zorlama prompt'u. Önceden her EventCard kendi <SignInPrompt>
 * (= <Modal>) render ediyordu → feed'de düzinelerce gizli Modal Android'de
 * dokunmayı bozuyordu (kartlara tıklanmıyordu). Artık TEK Modal kökte mount
 * edilir; herhangi bir yer showAuthPrompt() ile tetikler.
 */
type State = { visible: boolean; title: string };
type Listener = (s: State) => void;

let state: State = { visible: false, title: "" };
const listeners = new Set<Listener>();

export function showAuthPrompt(title: string) {
  state = { visible: true, title };
  listeners.forEach((l) => l(state));
}

export function hideAuthPrompt() {
  state = { visible: false, title: state.title };
  listeners.forEach((l) => l(state));
}

export function useAuthPromptState(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
