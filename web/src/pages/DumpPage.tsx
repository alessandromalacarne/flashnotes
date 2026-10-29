import { useCallback } from 'react';
import { createDump } from '../api';
import { Composer } from '../components/Composer';

export function DumpPage() {
  const handleSubmit = useCallback(async (content: string) => {
    await createDump(content);
  }, []);

  return (
    <>
      <h1 className="sr-only">quickdump</h1>
      <Composer onSubmit={handleSubmit} />
    </>
  );
}
