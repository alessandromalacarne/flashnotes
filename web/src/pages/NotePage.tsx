import { useCallback } from 'react';
import { createNote } from '../api';
import { Composer } from '../components/Composer';

export function NotePage() {
  const handleSubmit = useCallback(async (content: string) => {
    await createNote(content);
  }, []);

  return (
    <>
      <h1 className="sr-only">flashnotes</h1>
      <Composer onSubmit={handleSubmit} />
    </>
  );
}
