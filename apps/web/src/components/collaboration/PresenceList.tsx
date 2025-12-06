'use client';

import styles from './PresenceList.module.css';

interface UserPresence {
  id: string;
  name: string;
  color: string;
}

interface PresenceListProps {
  users: UserPresence[];
  currentUserId: string;
}

export default function PresenceList({ users, currentUserId }: PresenceListProps) {
  const otherUsers = users.filter(u => u.id !== currentUserId);
  
  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.avatars}>
        {otherUsers.slice(0, 5).map((user) => (
          <div
            key={user.id}
            className={styles.avatar}
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {otherUsers.length > 5 && (
          <div className={styles.more}>
            +{otherUsers.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}
