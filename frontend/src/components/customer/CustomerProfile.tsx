import { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import toast from 'react-hot-toast';
import FloatingLines from '../../components/ui/FloatingLines';
import PhoneUpdateModal from './dashboard/PhoneUpdateModal';
import { Camera, Mail, MapPin, BellRing, Phone } from 'lucide-react';

export default function CustomerProfile() {
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    photoURL: '',
    notifications: {
      orderUpdates: true,
      promotions: false,
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  
  // Password State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            name: data.name || '',
            phone: data.phone || '',
            photoURL: data.photoURL || '',
            notifications: data.notifications || { orderUpdates: true, promotions: false }
          });
        }
      } catch (err) {
        console.error("Failed to load profile", err);
        toast.error("Could not load profile details.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(docRef, {
        name: profile.name,
        notifications: profile.notifications
        // phone is updated securely via PhoneUpdateModal
        // photoURL is updated separately
      });
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile", err);
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;
    setPasswordLoading(true);
    try {
      // Re-authenticate
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update Password
      await updatePassword(auth.currentUser, newPassword);
      toast.success("Password changed successfully!");
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      console.error("Password update failed", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error("Current password is incorrect.");
      } else {
        toast.error("Failed to change password.");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetEmail = async () => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    try {
      const res = await fetch("/api/email/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: auth.currentUser.email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send reset email");
      }
      toast.success("Password reset link sent to your email.");
    } catch (err: any) {
      console.error("Failed to send reset email", err);
      toast.error(err.message || "Could not send reset email.");
    }
  };

  if (loading) return <div className="text-center p-8">Loading profile...</div>;

  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <FloatingLines 
          linesGradient={['#f97316', '#eab308']} 
          parallax={false} 
          interactive={false} 
          bendStrength={0}
        />
      </div>
      
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
      {/* Profile Edit Form */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
          <span>📝</span> Personal Details
        </h2>
        
        {/* Profile Photo Upload */}
        <div className="flex justify-center mb-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-slate-400">{profile.name.charAt(0).toUpperCase() || '?'}</span>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-2 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Camera className="w-4 h-4" />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  toast.error("Cloud storage setup required to upload images.");
                  // Future: upload to Firebase storage or Cloudinary and set profile.photoURL
                }
              }}/>
            </label>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Email</label>
            <input 
              type="email" 
              value={auth.currentUser?.email || ''} 
              disabled
              className="w-full bg-slate-100 dark:bg-slate-900 border-none p-3 rounded-xl text-slate-800 dark:text-white opacity-70 cursor-not-allowed"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
              <input 
                type="text" 
                required
                value={profile.name}
                onChange={e => setProfile({...profile, name: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:border-primary-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Phone Number</label>
              <div className="flex bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:border-primary-500 transition-colors">
                <input 
                  type="text" 
                  value={profile.phone}
                  disabled
                  className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none cursor-not-allowed opacity-80"
                />
                <button
                  type="button"
                  onClick={() => setIsPhoneModalOpen(true)}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 font-bold transition-colors"
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-primary-500" /> Notification Preferences
            </h3>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-3">
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm">Order Updates (Important)</p>
                <p className="text-xs text-slate-500">Live tracking and status alerts.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={profile.notifications.orderUpdates}
                  onChange={(e) => setProfile({
                    ...profile,
                    notifications: { ...profile.notifications, orderUpdates: e.target.checked }
                  })}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm">Offers & Promotions</p>
                <p className="text-xs text-slate-500">Coupons and festival offers.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={profile.notifications.promotions}
                  onChange={(e) => setProfile({
                    ...profile,
                    notifications: { ...profile.notifications, promotions: e.target.checked }
                  })}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-xl shadow-lg shadow-primary-500/30 transition-transform active:scale-95 disabled:opacity-70 mt-4"
          >
            {saving ? 'Saving...' : 'Update Details'}
          </button>
        </form>
      </div>

      {/* Security Section */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
            <span>🔒</span> Security & Password
          </h2>
          
          {!showPasswordChange ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Current Password</label>
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="font-mono text-slate-600 dark:text-slate-400">••••••••••••</span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">ENCRYPTED</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 mt-2">
                  For your security, passwords are hashed and cannot be shown in plain text.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={() => setShowPasswordChange(true)}
                  className="w-full border-2 border-primary-500 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 font-bold py-3 rounded-xl transition-colors"
                >
                  Change Password
                </button>
                <button 
                  onClick={handleResetEmail}
                  className="w-full font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 py-2 transition-colors"
                >
                  Send Password Reset Link via Email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Current Password</label>
                <input 
                  type="password" 
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:border-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">New Password</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:border-primary-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setCurrentPassword('');
                    setNewPassword('');
                  }}
                  className="flex-1 font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 py-3 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={passwordLoading}
                  className="flex-[2] bg-primary-600 hover:bg-primary-700 text-white font-black py-3 rounded-xl shadow-lg disabled:opacity-70 transition-colors"
                >
                  {passwordLoading ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <PhoneUpdateModal 
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        currentPhone={profile.phone}
        onSuccess={(newPhone) => setProfile(prev => ({ ...prev, phone: newPhone }))}
      />
    </div>
    </>
  );
}
