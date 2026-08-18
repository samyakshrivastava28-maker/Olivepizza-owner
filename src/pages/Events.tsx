import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'events'), (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    try {
      await addDoc(collection(db, 'events'), { title, date, createdAt: new Date() });
      toast.success('Calendar event saved.');
      setTitle('');
      setDate('');
    } catch (e: any) {
      toast.error('Add failed: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
      toast.success('Event removed.');
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Events & Festival Marketing</h2>
        <p className="text-xs text-slate-400">Plan festive seasonal promotions, holiday specials, and marketing calendars.</p>
      </div>

      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-6 max-w-lg">
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Event / Festival Name</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali Weekend Mega Pizza Bash"
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Target Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs"
          >
            Add Calendar Event
          </button>
        </form>
      </div>

      <div className="space-y-2 max-w-lg">
        {events.map((ev) => (
          <div key={ev.id} className="p-3 bg-[#131B2B] border border-slate-800 rounded-xl flex justify-between items-center text-xs">
            <div>
              <p className="font-bold text-white">{ev.title}</p>
              <p className="text-slate-400 font-mono text-[10px]">{ev.date}</p>
            </div>
            <button onClick={() => handleDelete(ev.id)} className="p-1.5 text-slate-400 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
