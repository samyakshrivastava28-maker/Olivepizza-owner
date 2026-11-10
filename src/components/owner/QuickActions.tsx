import { Link } from 'react-router';

export default function QuickActions() {
  const actions = [
    { name: '🎨 Olive Studio', icon: '🍕', path: '/owner/studio', color: 'bg-orange-500/30 text-orange-300 ring-2 ring-orange-500/50' },
    { name: 'Add Product', icon: '🍕', path: '/owner/products', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' },
    { name: 'Create Coupon', icon: '🎟️', path: '/owner/coupons', color: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400' },
    { name: 'New Ad Campaign', icon: '📢', path: '/owner/ads', color: 'bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400' },
    { name: 'Analytics', icon: '📊', path: '/owner/analytics', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
      {actions.map((action) => (
        <Link 
          key={action.name} 
          to={action.path}
          className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 hover:shadow-lg transition-all text-center group"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${action.color}`}>
            {action.icon}
          </div>
          <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{action.name}</span>
        </Link>
      ))}
    </div>
  );
}
