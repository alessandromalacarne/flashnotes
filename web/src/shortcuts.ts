// The submit shortcut is keyboard-only, so it follows the primary pointer.
// `pointer: coarse` matches phones and tablets, while a hybrid laptop with a
// mouse stays `fine` and keeps the shortcut. `any-pointer: coarse` would also
// disable it on those hybrids, which is not the assumption we want.
export function usesTouchPointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function isSubmitShortcut(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>,
): boolean {
  return event.key === 'Enter' && event.shiftKey && !usesTouchPointer();
}
