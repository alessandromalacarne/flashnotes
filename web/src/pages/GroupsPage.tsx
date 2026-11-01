import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listGroups, deleteGroup, type GroupWithCount } from '../api';
import { GroupCard } from '../components/GroupCard';

function useGroupList() {
  const [groups, setGroups] = useState<GroupWithCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listGroups()
      .then((loaded) => {
        if (active) {
          setGroups(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load the groups',
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { groups, error, setGroups, setError };
}

function useGroups() {
  const { groups, error, setGroups, setError } = useGroupList();

  async function remove(id: string) {
    try {
      await deleteGroup(id);
      setGroups((current) =>
        current === null ? current : current.filter((group) => group.id !== id),
      );
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete the group',
      );
    }
  }

  return { groups, error, remove };
}

export function GroupsPage() {
  const { groups, error, remove } = useGroups();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <h1 className="text-sm font-medium tracking-widest text-ink-faint uppercase">
        groups
      </h1>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {groups === null ? (
        <p role="status" className="mt-4 text-sm text-ink-faint">
          loading groups…
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No groups yet.{' '}
          <Link
            to="/app"
            className="text-mark underline-offset-4 hover:underline"
          >
            write a note
          </Link>{' '}
          to create the first one.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} onDelete={remove} />
          ))}
        </ul>
      )}
    </section>
  );
}
