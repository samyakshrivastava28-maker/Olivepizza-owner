import { useState, useEffect, memo } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

function ActivityFeed() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="glass-card p-6 h-full">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <span>⚡</span> Recent Activity
      </h3>
      <div className="space-y-4 overflow-y-auto max-h-96 pr-2">
        {logs.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No recent activity.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-4 items-start border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0">
              <div className="mt-1 bg-primary-100 dark:bg-primary-900/30 w-2 h-2 rounded-full shrink-0"></div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{log.details}</p>
                {log.timestamp && (
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                    {typeof log.timestamp?.toDate === 'function' ? log.timestamp.toDate().toLocaleString() : new Date(log.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(ActivityFeed);
